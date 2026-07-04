import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { type Condition, type LensNarrowing, Operator } from '@inixiative/json-rules';
import { clearHookRegistry } from '@template/db';
import { lensFor } from '@template/db/lens';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import type { EmailClient, SendEmailOptions } from '@template/email/client/types';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerUserEmailContactHook } from '#/hooks/userEmailContact/hook';
import { sendEmail } from '#/jobs/handlers/sendEmail';
import { emailRegistry } from '#/lib/email';
import { type EmailEntry, type RecipientDefinition, registry } from '#/lib/email/registry';
import { createTestApp } from '#tests/createTestApp';

registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();
registerUserEmailContactHook();

const ADAPTER = 'test-recorder';

const userLens = (id: unknown): LensNarrowing => ({
  parent: lensFor('User'),
  root: {
    where: { field: 'id', operator: Operator.equals, value: id } as unknown as Condition,
    picks: ['id', 'name', 'email'],
  },
});

const recipientSelf: RecipientDefinition = {
  picks: ['id', 'name', 'email'],
  where: (user) => ({ field: 'id', operator: Operator.equals, value: (user as { id: string }).id }) as unknown as Condition,
};

const recipientsIn = (ids: string[]): RecipientDefinition => ({
  picks: ['id', 'name', 'email'],
  where: () => ({ field: 'id', operator: Operator.in, value: ids }) as unknown as Condition,
});

const plainMjml = (body: string) =>
  `<mjml><mj-body><mj-section><mj-column><mj-text>${body}</mj-text></mj-column></mj-section></mj-body></mjml>`;

describe('sendEmail handler', () => {
  let testDb: ReturnType<typeof createTestApp>['db'];
  const sent: SendEmailOptions[] = [];
  const added: string[] = [];

  const addEntry = (slug: string, entry: EmailEntry) => {
    registry[slug] = entry;
    added.push(slug);
  };

  beforeAll(() => {
    testDb = createTestApp({}).db;
    const recorder: EmailClient = {
      send: async (options) => {
        sent.push(options);
        return { id: `rec-${sent.length}`, success: true };
      },
      sendBatch: async (batch) => batch.map((_, i) => ({ id: `rec-${i}`, success: true })),
    };
    emailRegistry.register(ADAPTER, recorder);
  });

  afterAll(async () => {
    emailRegistry.unregister(ADAPTER);
    await cleanupTouchedTables(testDb);
    clearHookRegistry();
  });

  afterEach(() => {
    for (const slug of added) delete registry[slug];
    added.length = 0;
    sent.length = 0;
  });

  const ctx = () => ({ db: testDb, log: () => {} }) as never;

  it('fans out one email per resolved recipient', async () => {
    const { entity: alice } = await createUser({ name: 'Alice' });
    const { entity: bob } = await createUser({ name: 'Bob' });
    await createEmailTemplate({
      slug: 'test-fanout',
      subject: 'Hi {{recipient.name}}',
      mjml: plainMjml('Hi {{recipient.name}}'),
    });

    addEntry('test-fanout', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientsIn([alice.id, bob.id]),
    });

    await sendEmail(ctx(), { eventName: 'test', template: 'test-fanout', data: { userId: alice.id } });

    expect(sent.map((s) => s.to).sort()).toEqual([alice.email, bob.email].sort());
    expect(sent.every((s) => s.cc === undefined && s.bcc === undefined)).toBe(true);
  });

  it('resolves cc per recipient and attaches it to that recipient’s email', async () => {
    const { entity: rep } = await createUser({ name: 'Rep' });
    const { entity: manager } = await createUser({ name: 'Manager' });
    await createEmailTemplate({ slug: 'test-cc', subject: 'Hi', mjml: plainMjml('Hi') });

    addEntry('test-cc', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientSelf,
      cc: () => userLens(manager.id),
    });

    await sendEmail(ctx(), { eventName: 'test', template: 'test-cc', data: { userId: rep.id } });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(rep.email);
    expect(sent[0].cc).toEqual([manager.email]);
  });

  it('records one sent communication log per recipient, linking sender + contact + template', async () => {
    const { entity: u } = await createUser({ name: 'Ledger' });
    await createEmailTemplate({ slug: 'test-log', subject: 'Hi', mjml: plainMjml('Hi') });
    addEntry('test-log', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientSelf,
    });

    await sendEmail(ctx(), { eventName: 'log-evt', template: 'test-log', data: { userId: u.id } });

    const rows = await testDb.communicationLog.findMany({ where: { recipientUserId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sent');
    expect(rows[0].channel).toBe('email');
    expect(rows[0].senderType).toBe('platform');
    expect(rows[0].address).toBe(u.email);
    expect(rows[0].recipientContactId).not.toBeNull();
    expect(rows[0].emailTemplateId).not.toBeNull();
    expect(rows[0].providerMessageId).not.toBeNull();
  });

  it('is idempotent: a duplicate send collapses to one log row and one delivery', async () => {
    const { entity: u } = await createUser({ name: 'Dedup' });
    await createEmailTemplate({ slug: 'test-dedup', subject: 'Hi', mjml: plainMjml('Hi') });
    addEntry('test-dedup', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientSelf,
    });

    const payload = { eventName: 'dedup-evt', template: 'test-dedup', data: { userId: u.id } };
    await sendEmail(ctx(), payload);
    await sendEmail(ctx(), payload);

    const rows = await testDb.communicationLog.findMany({ where: { recipientUserId: u.id } });
    expect(rows).toHaveLength(1);
    expect(sent.filter((s) => s.to === u.email)).toHaveLength(1);
  });

  it('suppresses delivery when the recipient has opted out of the kind', async () => {
    const { entity: u } = await createUser({ name: 'OptOut' });
    await createEmailTemplate({ slug: 'test-promo', subject: 'Promo', mjml: plainMjml('Promo'), kind: 'marketing' });
    addEntry('test-promo', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientSelf,
    });

    await sendEmail(ctx(), { eventName: 'promo-evt', template: 'test-promo', data: { userId: u.id } });

    const rows = await testDb.communicationLog.findMany({ where: { recipientUserId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('suppressed');
    expect(sent.filter((s) => s.to === u.email)).toHaveLength(0);
  });

  it('adds the List-Unsubscribe header + body link on non-system kinds', async () => {
    const { entity: u } = await createUser({ name: 'Subscriber' });
    await createEmailTemplate({
      slug: 'test-unsub-link',
      subject: 'News',
      mjml: plainMjml('News {{system.unsubscribeUrl}}'),
      kind: 'platform',
    });
    addEntry('test-unsub-link', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientSelf,
    });

    await sendEmail(ctx(), { eventName: 'unsub-link-evt', template: 'test-unsub-link', data: { userId: u.id } });

    expect(sent).toHaveLength(1);
    expect(sent[0].headers?.['List-Unsubscribe']).toMatch(/\/unsubscribe\?token=/);
    expect(sent[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(sent[0].html).toMatch(/\/unsubscribe\?token=/);
  });

  it('marks undeliverable and skips the send for a known-bad address', async () => {
    const { entity: u } = await createUser({ name: 'BadAddr' });
    const contact = await testDb.contact.findFirstOrThrow({ where: { userId: u.id, type: 'email' } });
    await testDb.contact.update({
      where: { id: contact.id },
      data: { deliverability: 'undeliverable', deliverabilityCheckedAt: new Date() },
    });
    await createEmailTemplate({ slug: 'test-bad', subject: 'Hi', mjml: plainMjml('Hi'), kind: 'platform' });
    addEntry('test-bad', {
      entity: (data) => userLens(data.userId),
      sender: () => ({ type: 'platform' }),
      recipients: recipientSelf,
    });

    await sendEmail(ctx(), { eventName: 'bad-evt', template: 'test-bad', data: { userId: u.id } });

    const rows = await testDb.communicationLog.findMany({ where: { recipientUserId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('undeliverable');
    expect(sent.filter((s) => s.to === u.email)).toHaveLength(0);
  });
});
