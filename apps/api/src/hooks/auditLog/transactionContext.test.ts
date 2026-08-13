import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import { cleanupTouchedTables } from '@template/db/test';
import { saveEmailTemplate } from '@template/email/render';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';

// saveEmailTemplate is the deterministic case in this repo where async-local storage does not
// survive into the mutation extension's continuation, so it is the path that pins the bridge:
// before it, the audit hook read a null actor here and attributed every row to nobody.
const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

const actorTemplate = () => ({
  slug: 'actor-probe',
  name: 'Actor Probe',
  subject: 'Hi',
  kind: 'system' as const,
  mjml: mjml('{{#component:actorgreeting}}<mj-text>Hello</mj-text>{{/component:actorgreeting}}'),
  ownerModel: 'default' as const,
});

describe('audit actor across a transaction whose storage is lost in the hook frame', () => {
  beforeAll(() => {
    registerAuditLogHook();
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

  it('attributes every audit row to the actor set at the caller', async () => {
    const actorJobName = 'transactionContextProbe';

    await auditActorContext.scope({ ...nullAuditActor, actorJobName }, async () => {
      await saveEmailTemplate(actorTemplate());
    });

    const auditRows = await db.auditLog.findMany({
      where: { subjectModel: { in: ['EmailComponent', 'EmailTemplate'] } },
    });

    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.map((row) => row.actorJobName)).toEqual(auditRows.map(() => actorJobName));
  });

  it('leaves the actor null when the caller set none', async () => {
    await saveEmailTemplate(actorTemplate());

    const auditRows = await db.auditLog.findMany({
      where: { subjectModel: { in: ['EmailComponent', 'EmailTemplate'] } },
    });

    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.every((row) => row.actorJobName === null)).toBe(true);
  });
});
