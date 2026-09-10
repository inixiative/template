/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { SyncPreflightCheck } from '@template/email/preflight/types';

export const subjectPresent: SyncPreflightCheck = ({ subject }) =>
  subject.trim()
    ? []
    : [
        {
          code: 'subject.missing',
          severity: 'error',
          message: 'The email renders with no subject.',
          location: 'subject',
        },
      ];
