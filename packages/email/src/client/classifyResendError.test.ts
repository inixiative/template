import { describe, expect, it } from 'bun:test';
import { classifyResendError } from '@template/email/client/classifyResendError';
import { EmailProviderError } from '@template/email/errors/EmailProviderError';

describe('classifyResendError', () => {
  it.each([
    ['rate_limit_exceeded', 429, 'rate_limit'],
    ['concurrent_idempotent_requests', 409, 'rate_limit'],
    ['daily_quota_exceeded', 429, 'quota'],
    ['monthly_quota_exceeded', 429, 'quota'],
    ['application_error', 500, 'transient'],
    ['internal_server_error', 503, 'transient'],
    ['application_error', null, 'ambiguous'],
    ['application_error', 408, 'ambiguous'],
    ['invalid_api_key', 403, 'auth'],
    ['validation_error', 422, 'validation'],
    ['invalid_from_address', 422, 'validation'],
    ['not_found', 404, 'not_found'],
    ['something_new', 418, 'permanent'],
    ['something_new', 429, 'rate_limit'],
  ] as const)('%s (%p) is %s', (name, statusCode, classification) => {
    expect(classifyResendError({ name, statusCode, message: 'x' })).toBe(classification);
  });

  it('retries only failures the provider definitely did not accept', () => {
    const retryable = (classification: EmailProviderError['classification']) =>
      new EmailProviderError('Resend', classification, null, 'code', 'message').isRetryable;
    expect(retryable('rate_limit')).toBe(true);
    expect(retryable('transient')).toBe(true);
    expect(retryable('ambiguous')).toBe(false);
    expect(retryable('quota')).toBe(false);
    expect(retryable('validation')).toBe(false);
  });
});
