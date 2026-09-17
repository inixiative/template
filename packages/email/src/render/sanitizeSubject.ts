/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { unescape as unescapeHtml } from 'lodash-es';

// biome-ignore lint/suspicious/noControlCharactersInRegex: header-injection guard — CR/LF and friends must not reach the Subject header
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]+/g;

export const sanitizeSubject = (subject: string): string =>
  unescapeHtml(subject).replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
