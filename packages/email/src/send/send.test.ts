import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import type { EmailClient, SendEmailOptions } from '@template/email/client';
import type { VerificationResult } from '@template/email/client/verification';
import { emailRegistry, sendEmail, setEmailVerifier } from '@template/email/send';

describe('sendEmail pipeline', () => {
  let userA: User;
  let userB: User;
  let sendBatch: ReturnType<typeof mock>;
  let send: ReturnType<typeof mock>;
  let verifyResults: Map<string, VerificationResult>;

  const mockLog = () => {};

  beforeAll(async () => {
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
    for (const name of emailRegistry.names()) emailRegistry.unregister(name);

    sendBatch = mock(async (opts: SendEmailOptions[]) =>
      opts.map((_, i) => ({ id: `sent-${i}`, success: true })),
    );
    send = mock(async () => ({ id: 'sent-single', success: true }));

    emailRegistry.register('mock', {
      send,
      sendBatch,
    } as unknown as EmailClient);

    verifyResults = new Map();
    setEmailVerifier({
      verify: async (email: string): Promise<VerificationResult> =>
        verifyResults.get(email) ?? {
          email,
          status: 'deliverable',
          isDisposable: false,
          didYouMean: null,
        },
    });
  });

  afterEach(() => {
    for (const name of emailRegistry.names()) emailRegistry.unregister(name);
    setEmailVerifier({
      verify: async (email: string): Promise<VerificationResult> => ({
        email,
        status: 'deliverable',
        isDisposable: false,
        didYouMean: null,
      }),
    });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('resolves userIds to addresses and sends one email per recipient', async () => {
    await sendEmail(
      db,
      {
        to: [{ userIds: [userA.id, userB.id] }],
        template: 'sendemail-test',
        data: {},
        tags: ['test'],
      },
      mockLog,
    );

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const batch = sendBatch.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    const byTo = Object.fromEntries(batch.map((b: SendEmailOptions) => [b.to, b]));
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

    await sendEmail(
      db,
      {
        to: [{ userIds: [userA.id, userB.id] }],
        template: 'sendemail-test',
        data: {},
        tags: [],
      },
      mockLog,
    );

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

    await sendEmail(
      db,
      {
        to: [{ raw: ['a@example.com'] }],
        cc: [{ raw: ['b@example.com', 'c@example.com'] }],
        bcc: [{ raw: ['d@example.com'] }],
        template: 'sendemail-test',
        data: {},
        tags: [],
      },
      mockLog,
    );

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const msg = sendBatch.mock.calls[0][0][0];
    expect(msg.cc).toEqual(['c@example.com']);
    expect(msg.bcc).toEqual(['d@example.com']);
  });

  it('throws a clear error when no email adapters are registered', async () => {
    for (const name of emailRegistry.names()) emailRegistry.unregister(name);

    await expect(
      sendEmail(
        db,
        {
          to: [{ raw: ['a@example.com'] }],
          template: 'sendemail-test',
          data: {},
          tags: [],
        },
        mockLog,
      ),
    ).rejects.toThrow('No email adapters are registered');
  });

  it('no-ops when no recipients resolve', async () => {
    await sendEmail(
      db,
      {
        to: [{ userIds: [] }],
        template: 'sendemail-test',
        data: {},
        tags: [],
      },
      mockLog,
    );

    expect(sendBatch).not.toHaveBeenCalled();
  });
});
