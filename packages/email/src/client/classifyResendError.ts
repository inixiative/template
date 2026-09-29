/**
 * @atlas
 * @kind utils
 * @partOf feature:email, integration:resend
 * @uses none
 */
import type { EmailProviderErrorClassification } from '@template/email/errors/EmailProviderError';

export type ResendErrorResponse = { name: string; statusCode: number | null; message: string };

const CLASSIFICATION_BY_CODE: Record<string, EmailProviderErrorClassification> = {
  rate_limit_exceeded: 'rate_limit',
  concurrent_idempotent_requests: 'rate_limit',
  daily_quota_exceeded: 'quota',
  monthly_quota_exceeded: 'quota',
  missing_api_key: 'auth',
  restricted_api_key: 'auth',
  invalid_api_key: 'auth',
  invalid_access: 'auth',
  security_error: 'auth',
  not_found: 'not_found',
  validation_error: 'validation',
  invalid_parameter: 'validation',
  missing_required_field: 'validation',
  invalid_from_address: 'validation',
  invalid_attachment: 'validation',
  invalid_region: 'validation',
  invalid_idempotency_key: 'validation',
  invalid_idempotent_request: 'validation',
  method_not_allowed: 'validation',
};

export const classifyResendError = ({ name, statusCode }: ResendErrorResponse): EmailProviderErrorClassification => {
  if (statusCode === null || statusCode === 408) return 'ambiguous';
  const byCode = CLASSIFICATION_BY_CODE[name];
  if (byCode) return byCode;
  if (statusCode === 429) return 'rate_limit';
  if (statusCode >= 500) return 'transient';
  return 'permanent';
};
