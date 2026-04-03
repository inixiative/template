import { join } from 'node:path';
import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { VCR } from '@template/shared/vcr';
import { Resend } from 'resend';

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

const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

class ResendEmailClient implements EmailClient {
  readonly vcr = new VCR(FIXTURES_DIR, { send: { keys: SANITIZE_KEYS } });
  private readonly resend: Resend;

  constructor(apiKey: string) {
    this.resend = getResendClient(apiKey);
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (process.env.NODE_ENV !== 'test') return this._send(options);
    return this.vcr.capture('send', () => this._send(options));
  }

  async sendBatch(batch: SendEmailOptions[]): Promise<SendEmailResult[]> {
    if (!batch.length) return [];

    const results: SendEmailResult[] = [];
    for (const batchChunk of chunk(batch, MAX_BATCH_SIZE)) {
      if (process.env.NODE_ENV !== 'test') {
        results.push(...(await this._sendBatch(batchChunk)));
      } else {
        results.push(...(await this.vcr.capture('sendBatch', () => this._sendBatch(batchChunk))));
      }
    }
    return results;
  }

  private async _send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { data, error } = await this.resend.emails.send({
      to: options.to,
      from: options.from,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      tags: options.tags?.map((name) => ({ name, value: 'true' })),
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    return {
      id: data?.id ?? '',
      success: true,
    };
  }

  private async _sendBatch(batch: SendEmailOptions[]): Promise<SendEmailResult[]> {
    const { data, error } = await this.resend.batch.send(
      batch.map((options) => ({
        to: options.to,
        from: options.from,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
        tags: options.tags?.map((name) => ({ name, value: 'true' })),
      })),
    );

    if (error) {
      throw new Error(`Resend batch error: ${error.message}`);
    }

    return (data?.data ?? []).map((d) => ({
      id: d.id,
      success: true,
    }));
  }
}

export const createResendClient = (apiKey: string): ResendEmailClient => {
  return new ResendEmailClient(apiKey);
};
