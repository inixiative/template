/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { CommunicationReasonCode } from '@template/db/generated/client/enums';
import { EmailProviderError } from '@template/email/errors/EmailProviderError';

export const communicationReasonCodeFor = (error: unknown): CommunicationReasonCode => {
  if (!(error instanceof EmailProviderError)) return CommunicationReasonCode.send_error;
  switch (error.classification) {
    case 'rate_limit':
      return CommunicationReasonCode.rate_limit_exhausted;
    case 'transient':
      return CommunicationReasonCode.transient_exhausted;
    case 'ambiguous':
      return CommunicationReasonCode.ambiguous_timeout;
    case 'quota':
      return CommunicationReasonCode.quota_exceeded;
    case 'auth':
      return CommunicationReasonCode.auth;
    case 'validation':
      return CommunicationReasonCode.validation;
    case 'not_found':
      return CommunicationReasonCode.not_found;
    case 'permanent':
      return CommunicationReasonCode.permanent;
  }
};
