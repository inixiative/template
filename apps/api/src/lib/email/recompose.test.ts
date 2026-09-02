import { describe, expect, it } from 'bun:test';
import { type ComponentSnapshot, recomposeFromSnapshots } from '#/lib/email/recompose';

const loaderFrom = (snapshots: Record<string, ComponentSnapshot>) => async (auditLogId: string) =>
  snapshots[auditLogId] ?? null;

describe('recomposeFromSnapshots', () => {
  it('injects caller overrides into the pinned child body instead of discarding them', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: {
          mjml: '{{#component:card}}{{#slot:body}}OVERRIDE{{/slot:body}}{{/component:card}}',
          componentVersions: { card: 'card-v1' },
        },
        'card-v1': { mjml: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>', componentVersions: {} },
      }),
    );
    expect(result).toBe('<x>OVERRIDE</x>');
  });

  it('recomposes nested components through each snapshot version pin', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: { mjml: '{{#component:hero}}{{/component:hero}}', componentVersions: { hero: 'hero-v2' } },
        'hero-v2': {
          mjml: '{{#slot:body:default}}{{#component:cta}}{{/component:cta}}{{/slot:body:default}}',
          componentVersions: { cta: 'cta-v7' },
        },
        'cta-v7': { mjml: '<btn>Go</btn>', componentVersions: {} },
      }),
    );
    expect(result).toBe('<btn>Go</btn>');
  });

  it('renders a dangling pin (missing child snapshot) as empty rather than leaving raw grammar', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: { mjml: 'a{{#component:gone}}{{/component:gone}}b', componentVersions: { gone: null } },
      }),
    );
    expect(result).toBe('ab');
  });

  it('bounds a cyclic snapshot graph instead of recursing forever', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: { mjml: '{{#component:b}}{{/component:b}}', componentVersions: { b: 'b-v1' } },
        'b-v1': { mjml: 'B{{#component:a}}{{/component:a}}', componentVersions: { a: 'root' } },
      }),
    );
    expect(result).toBe('B');
  });

  it('returns null when the root snapshot is missing or has no mjml', async () => {
    expect(await recomposeFromSnapshots('missing', loaderFrom({}))).toBeNull();
  });
});

import { afterAll, afterEach, beforeAll } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { saveEmailTemplate } from '@template/email/render';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerEmailVersioningHook } from '#/hooks/emailVersioning/hook';
import { recomposeCommunication } from '#/lib/email/recompose';

const documentMjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

describe('recomposeCommunication (DB-backed)', () => {
  beforeAll(() => {
    registerAuditLogHook();
    registerEmailVersioningHook();
  });

  afterAll(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    await db.communicationLog.deleteMany({});
    await db.auditLog.deleteMany({});
    await db.emailTemplate.deleteMany({});
    await db.emailComponent.deleteMany({});
  });

  const savedPin = async () => {
    const { template } = await saveEmailTemplate({
      slug: 'recompose-sent',
      name: 'Recompose Sent',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('{{#component:recompose-hero}}<mj-text>Saved</mj-text>{{/component:recompose-hero}}'),
      ownerModel: 'default',
    });
    const pin = await db.auditLog.findFirst({
      where: { subjectEmailTemplateId: template.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!pin) throw new Error('expected a template snapshot');
    return { template, pin };
  };

  const createLog = (data: Record<string, unknown>) =>
    db.communicationLog.create({
      data: {
        sendKey: 'recompose-test',
        channel: 'email',
        address: 'fan@example.com',
        idempotencyKey: crypto.randomUUID(),
        senderType: 'platform',
        ...data,
      },
    });

  it('returns the recorded settledMjml — the sent truth — not a recompose of the save-time pin', async () => {
    const { template, pin } = await savedPin();
    const sent = '<mj-text>What the sender-scoped cascade actually rendered</mj-text>';
    const log = await createLog({
      emailTemplateId: template.id,
      emailTemplateAuditLogId: pin.id,
      settledMjml: sent,
    });

    expect(await recomposeCommunication(log.id)).toBe(sent);
  });

  it('falls back to the pinned snapshot for legacy rows without settledMjml', async () => {
    const { template, pin } = await savedPin();
    const log = await createLog({ emailTemplateId: template.id, emailTemplateAuditLogId: pin.id });

    expect(await recomposeCommunication(log.id)).toContain('Saved');
  });
});
