import { join } from 'node:path';
import { VCR } from '@template/shared/vcr';
import type { EmailVerifier, VerificationResult, VerificationStatus } from '@template/email/client/verification/types';

type BouncerResponse = {
  email: string;
  status: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  reason: string;
  domain: { name: string; acceptAll: boolean; disposable: boolean; free: boolean };
  account: { role: boolean; disabled: boolean; fullMailbox: boolean };
  didYouMean: string | null;
};

const BOUNCER_API = 'https://api.usebouncer.com';
const FIXTURES_DIR = join(import.meta.dir, '../../../tests/fixtures/bouncer');
const SANITIZE_KEYS = ['email', 'domain.name'];

const toResult = (data: BouncerResponse): VerificationResult => ({
  email: data.email,
  status: data.status as VerificationStatus,
  reason: data.reason,
  isDisposable: data.domain?.disposable ?? false,
  didYouMean: data.didYouMean,
});

class BouncerVerifierClient implements EmailVerifier {
  readonly vcr = new VCR(FIXTURES_DIR, { verify: { keys: SANITIZE_KEYS } });
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async verify(email: string): Promise<VerificationResult> {
    if (process.env.NODE_ENV !== 'test') return this._verify(email);
    return this.vcr.capture('verify', () => this._verify(email));
  }

  private async _verify(email: string): Promise<VerificationResult> {
    const url = `${BOUNCER_API}/v1.1/email/verify?email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      headers: { 'x-api-key': this.apiKey },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bouncer API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as BouncerResponse;
    return toResult(data);
  }
}

export const createBouncerVerifier = (apiKey: string): BouncerVerifierClient => {
  return new BouncerVerifierClient(apiKey);
};
