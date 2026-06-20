import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { type Condition, type LensNarrowing, Operator } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import type { EmailClient, SendEmailOptions } from '@template/email/client/types';
import { sendEmail } from '#/jobs/handlers/sendEmail';
import { emailRegistry } from '#/lib/email';
import { type EmailEntry, registry } from '#/lib/email/registry';
import { createTestApp } from '#tests/createTestApp';

const ADAPTER = 'test-recorder';

const userLens = (id: string): LensNarrowing => ({
  parent: lensFor('User'),
  root: {
    where: { field: 'id', operator: Operator.equals, value: id } as unknown as Condition,
    picks: ['id', 'name', 'email'],
  },
});

const usersLens = (ids: string[]): LensNarrowing => ({
  parent: lensFor('User'),
  root: {
    where: { field: 'id', operator: Operator.in, value: ids } as unknown as Condition,
    picks: ['id', 'name', 'email'],
  },
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
      source: (data) => userLens(data.userId as string),
      senders: () => [{ ownerModel: 'default' }],
      recipients: () => usersLens([alice.id, bob.id]),
    });

    await sendEmail(ctx(), { eventName: 'test', template: 'test-fanout', data: { userId: alice.id }, tags: [] });

    expect(sent.map((s) => s.to).sort()).toEqual([alice.email, bob.email].sort());
    expect(sent.every((s) => s.cc === undefined && s.bcc === undefined)).toBe(true);
  });

  it('resolves cc per recipient and attaches it to that recipient’s email', async () => {
    const { entity: rep } = await createUser({ name: 'Rep' });
    const { entity: manager } = await createUser({ name: 'Manager' });
    await createEmailTemplate({ slug: 'test-cc', subject: 'Hi', mjml: plainMjml('Hi') });

    addEntry('test-cc', {
      source: (data) => userLens(data.userId as string),
      senders: () => [{ ownerModel: 'default' }],
      recipients: (user) => userLens(user.id as string),
      cc: () => userLens(manager.id),
    });

    await sendEmail(ctx(), { eventName: 'test', template: 'test-cc', data: { userId: rep.id }, tags: [] });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(rep.email);
    expect(sent[0].cc).toEqual([manager.email]);
  });
});
