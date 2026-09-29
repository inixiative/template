import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { db } from '@template/db';
import { CommunicationReasonCode, CommunicationStatus } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createCommunicationLog } from '@template/db/test';
import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { EmailProviderError } from '@template/email/errors/EmailProviderError';
import { saveEmailTemplate } from '@template/email/render';
import { emailRegistry, emailVerifier } from '#/lib/email';
import { type DeliverEmailPayload, deliverEmailMessage } from '#/lib/email/deliverEmailMessage';

const ADAPTER = 'claim-policy-recorder';
const TEMPLATE = 'claim-policy-template';

const documentMjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

const providerError = (classification: EmailProviderError['classification'], status: number | null) =>
  new EmailProviderError('Resend', classification, status, `code_${classification}`, `${classification} failure`);

describe('deliverEmailMessage — claim policy', () => {
  const attempts: SendEmailOptions[] = [];
  const outcomes: Array<Error | SendEmailResult> = [];
  const waits: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    waits.push(ms);
  };

  beforeAll(() => {
    const recorder: EmailClient = {
      send: async (options) => {
        attempts.push(options);
        const outcome = outcomes.shift();
        if (outcome instanceof Error) throw outcome;
        return outcome ?? { id: `sent-${attempts.length}`, success: true };
      },
      sendBatch: async (batch) => batch.map((_, i) => ({ id: `batch-${i}`, success: true })),
    };
    emailRegistry.register(ADAPTER, recorder);
  });

  beforeEach(async () => {
    await saveEmailTemplate({
      slug: TEMPLATE,
      name: 'Claim policy',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('<mj-text>Hello</mj-text>'),
      ownerModel: 'default',
    });
  });

  afterEach(async () => {
    attempts.length = 0;
    outcomes.length = 0;
    waits.length = 0;
    await db.communicationComponentVersion.deleteMany({});
    await db.communicationLog.deleteMany({});
    await db.emailTemplate.deleteMany({});
  });

  afterAll(async () => {
    emailRegistry.unregister(ADAPTER);
    await cleanupTouchedTables(db);
  });

  const createLog = async (data: Parameters<typeof createCommunicationLog>[0] = {}) =>
    (await createCommunicationLog({ address: 'fan@example.com', ...data })).entity;

  const payloadFor = (logId: string, template = TEMPLATE): DeliverEmailPayload => ({
    template,
    sender: { type: 'platform' },
    recipient: { id: crypto.randomUUID(), name: 'Fan', email: 'fan@example.com' },
    data: {},
    communicationLogId: logId,
  });

  const rowOf = (id: string) => db.communicationLog.findUniqueOrThrow({ where: { id } });

  it('sends with the communication log id as the provider idempotency key', async () => {
    const log = await createLog();

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.idempotencyKey).toBe(log.id);
    expect((await rowOf(log.id)).status).toBe(CommunicationStatus.sent);
  });

  it('retries a rate limit and a 5xx inside the claim with exponential backoff, then sends', async () => {
    const log = await createLog();
    outcomes.push(providerError('rate_limit', 429), providerError('transient', 503));

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(3);
    expect(waits).toEqual([2_000, 4_000]);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.sent);
    expect(row.reasonCode).toBeNull();
  });

  it('records rate_limit_exhausted after five retries and does not throw', async () => {
    const log = await createLog();
    for (let i = 0; i < 6; i++) outcomes.push(providerError('rate_limit', 429));

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(6);
    expect(waits).toEqual([2_000, 4_000, 8_000, 16_000, 32_000]);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(CommunicationReasonCode.rate_limit_exhausted);
  });

  it.each([
    ['ambiguous', 408, CommunicationReasonCode.ambiguous_timeout],
    ['ambiguous', null, CommunicationReasonCode.ambiguous_timeout],
    ['quota', 429, CommunicationReasonCode.quota_exceeded],
    ['validation', 422, CommunicationReasonCode.validation],
    ['auth', 401, CommunicationReasonCode.auth],
  ] as const)('closes a %s failure (status %p) on the first attempt as %s', async (classification, status, reason) => {
    const log = await createLog();
    outcomes.push(providerError(classification, status));

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(1);
    expect(waits).toEqual([]);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(reason);
  });

  it.each([
    CommunicationStatus.failed,
    CommunicationStatus.sending,
    CommunicationStatus.sent,
    CommunicationStatus.suppressed,
    CommunicationStatus.undeliverable,
  ])('never reopens a %s row', async (status) => {
    const log = await createLog({ status });

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(0);
    expect((await rowOf(log.id)).status).toBe(status);
  });

  it('closes a render failure as render_failed without sending', async () => {
    const log = await createLog();

    await deliverEmailMessage(payloadFor(log.id, 'missing-template'), { sleep });

    expect(attempts).toHaveLength(0);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(CommunicationReasonCode.render_failed);
  });

  it('leaves the row queued and throws when an infrastructure dependency fails before the claim', async () => {
    const log = await createLog();
    const verify = spyOn(emailVerifier, 'verify').mockImplementation(async () => {
      throw new Error('verifier unavailable');
    });

    try {
      await expect(deliverEmailMessage(payloadFor(log.id), { sleep })).rejects.toThrow('verifier unavailable');
    } finally {
      verify.mockRestore();
    }

    expect(attempts).toHaveLength(0);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.queued);
    expect(row.reasonCode).toBeNull();
  });
});
