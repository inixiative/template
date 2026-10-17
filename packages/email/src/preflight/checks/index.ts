import type { PreflightCheck } from '../types';
import { imagesHaveAlt } from './imagesHaveAlt';
import { preheaderPresent } from './preheaderPresent';
import { renderWarningFindings } from './renderWarningFindings';
import { spamTriggerPhrases } from './spamTriggerPhrases';
import { subjectPresent } from './subjectPresent';
import { unresolvedLensPaths } from './unresolvedLensPaths';
import { unsubscribeLinkPresent } from './unsubscribeLinkPresent';

export { imagesHaveAlt } from './imagesHaveAlt';
export { preheaderPresent } from './preheaderPresent';
export { renderWarningFindings } from './renderWarningFindings';
export { SPAM_TRIGGER_PHRASES, spamTriggerPhrases } from './spamTriggerPhrases';
export { subjectPresent } from './subjectPresent';
export { unresolvedLensPaths } from './unresolvedLensPaths';
export { unsubscribeLinkPresent } from './unsubscribeLinkPresent';

export const ALL_PREFLIGHT_CHECKS: readonly PreflightCheck[] = [
  subjectPresent,
  preheaderPresent,
  unsubscribeLinkPresent,
  imagesHaveAlt,
  unresolvedLensPaths,
  renderWarningFindings,
  spamTriggerPhrases,
];
