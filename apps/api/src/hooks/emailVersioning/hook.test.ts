import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { expand, saveEmailTemplate } from '@template/email/render';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerEmailVersioningHook } from '#/hooks/emailVersioning/hook';
import { recomposeSnapshot } from '#/lib/email/recompose';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

const greetingTemplate = () => ({
  slug: 'welcome',
  name: 'Welcome',
  subject: 'Hi',
  kind: 'system' as const,
  mjml: mjml('{{#component:greeting}}<mj-text>Hello</mj-text>{{/component:greeting}}'),
  ownerModel: 'default' as const,
});

const latestSnapshot = (where: Record<string, unknown>) =>
  db.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' } });

describe('emailVersioning', () => {
  beforeAll(() => {
    registerAuditLogHook();
    registerEmailVersioningHook();
  });

  afterAll(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({});
    await db.emailTemplate.deleteMany({});
    await db.emailComponent.deleteMany({});
  });

  it('stamps a template snapshot with its child component audit-log ids', async () => {
    const { template, components } = await saveEmailTemplate(greetingTemplate());

    const componentSnapshot = await latestSnapshot({ subjectEmailComponentId: components[0].id });
    const templateSnapshot = await latestSnapshot({ subjectEmailTemplateId: template.id });

    expect(componentSnapshot).not.toBeNull();
    expect(templateSnapshot?.componentVersions).toEqual({ greeting: componentSnapshot!.id });
  });

  it('backpropagates a fresh template snapshot when a child component changes', async () => {
    const { template, components } = await saveEmailTemplate(greetingTemplate());
    const templatesBefore = await db.auditLog.count({ where: { subjectEmailTemplateId: template.id } });

    await db.emailComponent.update({ where: { id: components[0].id }, data: { mjml: '<mj-text>Updated</mj-text>' } });

    const newComponentSnapshot = await latestSnapshot({ subjectEmailComponentId: components[0].id });
    const templateSnapshots = await db.auditLog.findMany({
      where: { subjectEmailTemplateId: template.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(templateSnapshots.length).toBe(templatesBefore + 1);
    expect(templateSnapshots[0].componentVersions).toEqual({ greeting: newComponentSnapshot!.id });
  });

  it('recomposes each version from its snapshot, pinned to that version', async () => {
    const { template, components } = await saveEmailTemplate(greetingTemplate());
    const v1 = await latestSnapshot({ subjectEmailTemplateId: template.id });

    await db.emailComponent.update({ where: { id: components[0].id }, data: { mjml: '<mj-text>Updated</mj-text>' } });
    const v2 = await latestSnapshot({ subjectEmailTemplateId: template.id });

    const composedV2 = await recomposeSnapshot(v2!.id);
    expect(composedV2).toContain('Updated');
    expect(composedV2).not.toContain('Hello');

    const composedV1 = await recomposeSnapshot(v1!.id);
    expect(composedV1).toContain('Hello');
    expect(composedV1).not.toContain('Updated');
  });

  it('a no-op re-save neither adds nor rewrites a snapshot', async () => {
    const { template, components } = await saveEmailTemplate(greetingTemplate());
    const templatesBefore = await db.auditLog.findMany({
      where: { subjectEmailTemplateId: template.id },
      orderBy: { createdAt: 'desc' },
    });
    const componentsBefore = await db.auditLog.count({ where: { subjectEmailComponentId: components[0].id } });

    await saveEmailTemplate(greetingTemplate());

    const templatesAfter = await db.auditLog.findMany({
      where: { subjectEmailTemplateId: template.id },
      orderBy: { createdAt: 'desc' },
    });
    const componentsAfter = await db.auditLog.count({ where: { subjectEmailComponentId: components[0].id } });

    expect(templatesAfter.length).toBe(templatesBefore.length);
    expect(componentsAfter).toBe(componentsBefore);
    expect(templatesAfter[0].id).toBe(templatesBefore[0].id);
    expect(templatesAfter[0].componentVersions).toEqual(templatesBefore[0].componentVersions);
  });

  it('the latest snapshot recomposes to exactly the live composition — no drift', async () => {
    const { template, components } = await saveEmailTemplate(greetingTemplate());
    const ctx = {
      ownerModel: template.ownerModel,
      organizationId: template.organizationId,
      spaceId: template.spaceId,
      locale: template.locale,
    };

    const live1 = await expand(template.mjml, ctx);
    const snap1 = await latestSnapshot({ subjectEmailTemplateId: template.id });
    expect(await recomposeSnapshot(snap1!.id)).toBe(live1);

    await db.emailComponent.update({ where: { id: components[0].id }, data: { mjml: '<mj-text>Updated</mj-text>' } });

    const liveTemplate = await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } });
    const live2 = await expand(liveTemplate.mjml, ctx);
    const snap2 = await latestSnapshot({ subjectEmailTemplateId: template.id });
    expect(await recomposeSnapshot(snap2!.id)).toBe(live2);
  });

  it('pins null and flags the live row when a referenced component is removed with no fallback', async () => {
    const { template, components } = await saveEmailTemplate(greetingTemplate());

    await db.emailComponent.update({ where: { id: components[0].id }, data: { deletedAt: new Date() } });

    const templateSnapshot = await latestSnapshot({ subjectEmailTemplateId: template.id });
    expect(templateSnapshot?.componentVersions).toEqual({ greeting: null });

    const liveTemplate = await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(liveTemplate.degradedComponentRefs).toEqual(['greeting']);
  });
});
