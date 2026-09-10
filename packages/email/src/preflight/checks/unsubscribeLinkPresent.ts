/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { SyncPreflightCheck } from '@template/email/preflight/types';
import { parse } from 'node-html-parser';

export const unsubscribeLinkPresent: SyncPreflightCheck = ({ html }) =>
  parse(html)
    .querySelectorAll('a[href]')
    .some((anchor) => /unsubscribe/i.test(anchor.getAttribute('href') ?? ''))
    ? []
    : [
        {
          code: 'unsubscribe.missing',
          severity: 'warning',
          message: 'No unsubscribe link in the rendered body — link {{system.unsubscribeUrl}} or an unsubscribe page.',
          location: 'html',
        },
      ];
