import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import type { EmailClient, SendEmailOptions } from '@template/email/client';
import type { EmailVerifier, VerificationResult } from '@template/email/client/verification';
import { emailRegistry, emailVerifier } from '#/lib/email';
import { sendEmail } from '#/jobs/handlers/sendEmail';
import { createTestApp } from '#tests/createTestApp';

describe('sendEmail handler', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let userA: User;
  let userB: User;
  let sendBatch: ReturnType<typeof mock>;
  let send: ReturnType<typeof mock>;
  let previousAdapters: string[];
  let verifyOriginal: EmailVerifier['verify'];
  let verifyResults: Map<string, VerificationResult>;

  const mockLog = () => {};

  beforeAll(async () => {
    const harness = createTestApp();
    db = harness.db;

    const { entity: a } = await createUser({ email: 'a@example.com', name: 'Alice' });
    const { entity: b } = await createUser({ email: 'b@example.com', name: 'Bob' });
    userA = a;
    userB = b;

    await createEmailTemplate({
      slug: 'sendemail-test',
      locale: 'en',
      ownerModel: 'default',
      subject: 'Hello {{recipient.name}}',
      mjml: '<mjml><mj-body><mj-text>Hi {{recipient.name}} from {{sender.platformName}}</mj-text></mj-body></mjml>',
      componentRefs: [],
    });
  });

  beforeEach(() => {
    previousAdapters = emailRegistry.names();
    for (const name of previousAdapters) emailRegistry.unregister(name);

    sendBatch = mock(async (opts: SendEmailOptions[]) =>
      opts.map((_, i) => ({ id: `sent-${i}`, success: true })),
    );
    send = mock(async () => ({ id: 'sent-single', success: true }));

    emailRegistry.register('mock', {
      send,
      sendBatch,
    } as unknown as EmailClient);

    verifyResults = new Map();
    verifyOriginal = emailVerifier.verify.bind(emailVerifier);
    emailVerifier.verify = async (email: string): Promise<VerificationResult> =>
      verifyResults.get(email) ?? {
        email,
        status: 'deliverable',
        isDisposable: false,
        didYouMean: null,
      };
  });

  afterEach(() => {
    for (const name of emailRegistry.names()) emailRegistry.unregister(name);
    emailVerifier.verify = verifyOriginal;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const ctx = () => ({ db, log: mockLog }) as Parameters<typeof sendEmail>[0];

  it('resolves userIds to addresses and sends one email per recipient', async () => {
    await sendEmail(ctx(), {
      to: [{ userIds: [userA.id, userB.id] }],
      template: 'sendemail-test',
      data: {},
      tags: ['test'],
    });

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const batch = sendBatch.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    const byTo = Object.fromEntries(batch.map((b) => [b.to, b]));
    expect(byTo['a@example.com'].subject).toBe('Hello Alice');
    expect(byTo['b@example.com'].subject).toBe('Hello Bob');
    expect(byTo['a@example.com'].html).toContain('Hi Alice');
  });

  it('skips undeliverable and disposable addresses', async () => {
    verifyResults.set('a@example.com', {
      email: 'a@example.com',
      status: 'undeliverable',
      reason: 'no_mx',
      isDisposable: false,
      didYouMean: null,
    });
    verifyResults.set('b@example.com', {
      email: 'b@example.com',
      status: 'deliverable',
      isDisposable: true,
      didYouMean: null,
    });

    await sendEmail(ctx(), {
      to: [{ userIds: [userA.id, userB.id] }],
      template: 'sendemail-test',
      data: {},
      tags: [],
    });

    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('passes verified cc and bcc addresses through', async () => {
    verifyResults.set('b@example.com', {
      email: 'b@example.com',
      status: 'undeliverable',
      reason: 'hard_bounce',
      isDisposable: false,
      didYouMean: null,
    });

    await sendEmail(ctx(), {
      to: [{ raw: ['a@example.com'] }],
      cc: [{ raw: ['b@example.com', 'c@example.com'] }],
      bcc: [{ raw: ['d@example.com'] }],
      template: 'sendemail-test',
      data: {},
      tags: [],
    });

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const msg = sendBatch.mock.calls[0][0][0];
    expect(msg.cc).toEqual(['c@example.com']);
    expect(msg.bcc).toEqual(['d@example.com']);
  });

  it('throws a clear error when no email adapters are registered', async () => {
    for (const name of emailRegistry.names()) emailRegistry.unregister(name);

    await expect(
      sendEmail(ctx(), {
        to: [{ raw: ['a@example.com'] }],
        template: 'sendemail-test',
        data: {},
        tags: [],
      }),
    ).rejects.toThrow('No email adapters are registered');
  });

  it('no-ops when no recipients resolve', async () => {
    await sendEmail(ctx(), {
      to: [{ userIds: [] }],
      template: 'sendemail-test',
      data: {},
      tags: [],
    });

    expect(sendBatch).not.toHaveBeenCalled();
  });
});
