import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent, createOrganization, createSpace } from '@template/db/test';
import type { EmailClient, SendEmailOptions } from '@template/email/client/types';
import { saveEmailTemplate } from '@template/email/render';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerEmailVersioningHook } from '#/hooks/emailVersioning/hook';
import { type DeliverEmailPayload, deliverEmail } from '#/jobs/handlers/deliverEmail';
import { emailRegistry } from '#/lib/email';

const ADAPTER = 'closure-recorder';

const documentMjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

describe('deliverEmail — send-time component version closure', () => {
  const sent: SendEmailOptions[] = [];
  let rejectNextSend = false;

  beforeAll(() => {
    registerAuditLogHook();
    registerEmailVersioningHook();
    const recorder: EmailClient = {
      send: async (options) => {
        if (rejectNextSend) {
          rejectNextSend = false;
          return { id: 'rejected', success: false };
        }
        sent.push(options);
        return { id: `rec-${sent.length}`, success: true };
      },
      sendBatch: async (batch) => batch.map((_, i) => ({ id: `rec-${i}`, success: true })),
    };
    emailRegistry.register(ADAPTER, recorder);
  });

  afterAll(async () => {
    emailRegistry.unregister(ADAPTER);
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    sent.length = 0;
    await db.communicationComponentVersion.deleteMany({});
    await db.communicationLog.deleteMany({});
    await db.auditLog.deleteMany({});
    await db.emailTemplate.deleteMany({});
    await db.emailComponent.deleteMany({});
  });

  const ctx = () => ({ db, log: () => {} }) as never;

  const createLog = (data: Record<string, unknown>) =>
    db.communicationLog.create({
      data: {
        sendKey: 'closure-test',
        channel: 'email',
        address: 'fan@example.com',
        idempotencyKey: crypto.randomUUID(),
        senderType: 'platform',
        ...data,
      },
    });

  const payloadFor = (logId: string, sender: DeliverEmailPayload['sender']): DeliverEmailPayload => ({
    template: 'closure-template',
    sender,
    recipient: { id: crypto.randomUUID(), name: 'Fan', email: 'fan@example.com' },
    data: {},
    communicationLogId: logId,
  });

  it('pins the component rows the sender-scoped cascade resolved, at their current audit versions', async () => {
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({ organizationId: org.id });
    const { entity: defaultFooter } = await createEmailComponent({
      slug: 'closure-footer',
      mjml: '<mj-text>Default footer</mj-text>',
    });
    const { entity: spaceFooter } = await createEmailComponent({
      slug: 'closure-footer',
      ownerModel: 'Space',
      spaceId: space.id,
      organizationId: org.id,
      mjml: '<mj-text>Space footer</mj-text>',
    });
    await saveEmailTemplate({
      slug: 'closure-template',
      name: 'Closure',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('{{#component:closure-footer}}{{/component:closure-footer}}'),
      ownerModel: 'default',
    });
    const log = await createLog({ senderType: 'Space', senderSpaceId: space.id, senderOrganizationId: org.id });

    await deliverEmail(ctx(), payloadFor(log.id, { type: 'Space', spaceId: space.id, organizationId: org.id }));

    expect(sent).toHaveLength(1);
    const rows = await db.communicationComponentVersion.findMany({ where: { communicationLogId: log.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('closure-footer');
    expect(rows[0]?.emailComponentId).toBe(spaceFooter.id);
    expect(rows[0]?.emailComponentId).not.toBe(defaultFooter.id);

    const latest = await db.auditLog.findFirst({
      where: { subjectEmailComponentId: spaceFooter.id },
      orderBy: { id: 'desc' },
    });
    expect(latest).not.toBeNull();
    expect(rows[0]?.emailComponentAuditLogId).toBe(latest?.id ?? '');
  });

  it('captures the transitive closure — components resolved through other components', async () => {
    const { entity: cta } = await createEmailComponent({ slug: 'closure-cta', mjml: '<mj-text>Go</mj-text>' });
    const { entity: hero } = await createEmailComponent({
      slug: 'closure-hero',
      mjml: '{{#component:closure-cta}}{{/component:closure-cta}}',
      componentRefs: ['closure-cta'],
    });
    await saveEmailTemplate({
      slug: 'closure-template',
      name: 'Closure',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('{{#component:closure-hero}}{{/component:closure-hero}}'),
      ownerModel: 'default',
    });
    const log = await createLog({});

    await deliverEmail(ctx(), payloadFor(log.id, { type: 'platform' }));

    const rows = await db.communicationComponentVersion.findMany({ where: { communicationLogId: log.id } });
    expect(rows.map((row) => row.slug).sort()).toEqual(['closure-cta', 'closure-hero']);
    const byId = new Map(rows.map((row) => [row.slug, row.emailComponentId]));
    expect(byId.get('closure-cta')).toBe(cta.id);
    expect(byId.get('closure-hero')).toBe(hero.id);
  });

  it('a re-claimed retry rewrites the closure instead of duplicating rows', async () => {
    await createEmailComponent({ slug: 'closure-footer', mjml: '<mj-text>Footer</mj-text>' });
    await saveEmailTemplate({
      slug: 'closure-template',
      name: 'Closure',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('{{#component:closure-footer}}{{/component:closure-footer}}'),
      ownerModel: 'default',
    });
    const log = await createLog({});
    const payload = payloadFor(log.id, { type: 'platform' });

    rejectNextSend = true;
    await expect(deliverEmail(ctx(), payload)).rejects.toThrow('rejected send');
    await deliverEmail(ctx(), payload);

    const rows = await db.communicationComponentVersion.findMany({ where: { communicationLogId: log.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('closure-footer');
    const refreshed = await db.communicationLog.findUnique({ where: { id: log.id } });
    expect(refreshed?.status).toBe('sent');
  });

  it('writes no closure rows for a template with no component references', async () => {
    await saveEmailTemplate({
      slug: 'closure-template',
      name: 'Closure',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('<mj-text>Flat</mj-text>'),
      ownerModel: 'default',
    });
    const log = await createLog({});

    await deliverEmail(ctx(), payloadFor(log.id, { type: 'platform' }));

    expect(await db.communicationComponentVersion.count({ where: { communicationLogId: log.id } })).toBe(0);
    expect(sent).toHaveLength(1);
  });
});
