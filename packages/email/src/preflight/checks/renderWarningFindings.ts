/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { SyncPreflightCheck } from '@template/email/preflight/types';

export const renderWarningFindings: SyncPreflightCheck = ({ renderWarnings }) =>
  renderWarnings.map((message) => ({ code: 'render.warning', severity: 'error', message, location: 'mjml' }));
