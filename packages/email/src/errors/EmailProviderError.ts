/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export type EmailProviderErrorClassification =
  | 'rate_limit'
  | 'quota'
  | 'transient'
  | 'ambiguous'
  | 'auth'
  | 'validation'
  | 'not_found'
  | 'permanent';

export class EmailProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly classification: EmailProviderErrorClassification,
    readonly status: number | null,
    readonly providerCode: string,
    message: string,
  ) {
    super(`${provider} error (${providerCode}${status === null ? '' : ` ${status}`}): ${message}`);
    this.name = 'EmailProviderError';
  }

  // Retrying cannot double-deliver only when the provider definitely did not accept the message:
  // a rate limit or a 5xx. A 408, a network failure, or a quota wall is not retried.
  get isRetryable(): boolean {
    return this.classification === 'rate_limit' || this.classification === 'transient';
  }
}
