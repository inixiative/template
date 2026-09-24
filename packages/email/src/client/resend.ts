/**
 * @atlas
 * @kind client
 * @partOf feature:email, integration:resend
 * @uses primitive:shared
 */
import { join } from 'node:path';
import { classifyResendError, type ResendErrorResponse } from '@template/email/client/classifyResendError';
import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { EmailProviderError } from '@template/email/errors/EmailProviderError';
import { VCR } from '@template/shared/vcr';
import { Resend } from 'resend';

// Bun resolves the installed resend/package.json at runtime — version comes
// from the lockfile-pinned install. tsc can't resolve into node_modules JSON,
// so we bypass module resolution via Bun's require.
const resendPkg = import.meta.require('resend/package.json') as { version: string };

const FIXTURES_DIR = join(import.meta.dir, '../../tests/fixtures/resend');
const SANITIZE_KEYS = ['id'];
const MAX_BATCH_SIZE = 100;

const resendClients = new Map<string, Resend>();

const getResendClient = (apiKey: string): Resend => {
  const existingClient = resendClients.get(apiKey);
  if (existingClient) {
    return existingClient;
  }

  const resendClient = new Resend(apiKey);
  resendClients.set(apiKey, resendClient);
  return resendClient;
};

const toProviderError = (error: ResendErrorResponse): EmailProviderError =>
  new EmailProviderError('Resend', classifyResendError(error), error.statusCode, error.name, error.message);

const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const toResendPayload = (options: SendEmailOptions) => ({
  to: options.to,
  cc: options.cc,
  bcc: options.bcc,
  from: options.from,
  subject: options.subject,
  html: options.html,
  text: options.text,
  replyTo: options.replyTo,
  tags: options.tags?.map((name) => ({ name, value: 'true' })),
  headers: options.headers,
});

class ResendEmailClient implements EmailClient {
  readonly vcr = new VCR(FIXTURES_DIR, {
    service: 'resend',
    version: () => resendPkg.version,
    sanitizers: { send: { keys: SANITIZE_KEYS } },
  });
  private readonly resend: Resend;

  constructor(apiKey: string) {
    this.resend = getResendClient(apiKey);
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (process.env.NODE_ENV !== 'test') return this.__send(options);
    return this.vcr.capture('send', () => this.__send(options));
  }

  async sendBatch(batch: SendEmailOptions[]): Promise<SendEmailResult[]> {
    if (!batch.length) return [];

    const results: SendEmailResult[] = [];
    for (const batchChunk of chunk(batch, MAX_BATCH_SIZE)) {
      if (process.env.NODE_ENV !== 'test') {
        results.push(...(await this.__sendBatch(batchChunk)));
      } else {
        results.push(...(await this.vcr.capture('sendBatch', () => this.__sendBatch(batchChunk))));
      }
    }
    return results;
  }

  private async __send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { data, error } = await this.resend.emails.send(
      toResendPayload(options),
      options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    );

    if (error) throw toProviderError(error);

    return {
      id: data?.id ?? '',
      success: true,
    };
  }

  private async __sendBatch(batch: SendEmailOptions[]): Promise<SendEmailResult[]> {
    const { data, error } = await this.resend.batch.send(batch.map(toResendPayload));

    if (error) throw toProviderError(error);

    return (data?.data ?? []).map((d) => ({
      id: d.id,
      success: true,
    }));
  }
}

export const createResendClient = (apiKey: string): ResendEmailClient => {
  return new ResendEmailClient(apiKey);
};
