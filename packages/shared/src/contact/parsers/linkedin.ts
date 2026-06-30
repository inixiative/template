/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
import type { LinkedinClassifier } from '@template/shared/contact/constants/linkedin';
import { splitUrl } from '@template/shared/contact/parsers/url';

export type LinkedinValue = { classifier: LinkedinClassifier; handle: string };

const PREFIX_TO_CLASSIFIER: Record<string, LinkedinClassifier> = {
  in: 'personal',
  pub: 'personal',
  company: 'company',
  school: 'school',
};

export const parseLinkedinUrl = (url: string): LinkedinValue => {
  const parts = splitUrl(url);
  if (parts[0]?.toLowerCase() !== 'linkedin.com' || parts.length < 3) {
    throw new Error(`Unrecognized LinkedIn URL: ${url}`);
  }
  const prefix = parts[1]!.toLowerCase();
  const classifier = PREFIX_TO_CLASSIFIER[prefix];
  if (!classifier) throw new Error(`Unknown LinkedIn URL prefix '${prefix}' in ${url}`);
  // LinkedIn handles are case-insensitive. Lowercase so stored value matches
  // `toValueKey`'s lowercased key (no silent uniqueness bypass on case).
  return { classifier, handle: parts[2]!.toLowerCase() };
};
