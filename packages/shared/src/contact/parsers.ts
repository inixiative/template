// Lenient URL parsers for handle-type contacts. Each parser accepts the kinds
// of URLs users typically paste (with or without protocol, www subdomain,
// trailing slash, query params) and returns the canonical {classifier, handle}
// pair stored in Contact.value.
//
// Parsers throw on shapes they can't normalize — the rules hook turns those
// into a 422.

const stripQueryAndFragment = (s: string): string => s.split('?')[0]!.split('#')[0]!;
const trimSlashes = (s: string): string => s.replace(/^\/+|\/+$/g, '');

const stripWwwAndProtocol = (url: string): string =>
  url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');

export type LinkedinClassifier = 'personal' | 'company' | 'school';
export type LinkedinValue = { classifier: LinkedinClassifier; handle: string };

const LINKEDIN_PREFIX_TO_CLASSIFIER: Record<string, LinkedinClassifier> = {
  in: 'personal',
  pub: 'personal',
  company: 'company',
  school: 'school',
};

export const parseLinkedinUrl = (url: string): LinkedinValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  // Expect ['linkedin.com', '<prefix>', '<handle>', ...]
  if (parts[0]?.toLowerCase() !== 'linkedin.com' || parts.length < 3) {
    throw new Error(`Unrecognized LinkedIn URL: ${url}`);
  }
  const prefix = parts[1]!.toLowerCase();
  const handle = parts[2]!;
  const classifier = LINKEDIN_PREFIX_TO_CLASSIFIER[prefix];
  if (!classifier) throw new Error(`Unknown LinkedIn URL prefix '${prefix}' in ${url}`);
  return { classifier, handle };
};

export type GithubClassifier = 'user' | 'org';
export type GithubValue = { classifier: GithubClassifier; handle: string };

// GitHub URLs and bare handles share a slug namespace, but URLs alone don't
// reveal whether a slug is a user or an org. Caller passes the classifier
// when known (typical for OAuth flows); URL-only input defaults to 'user'.
export const parseGithubUrl = (url: string, hint?: GithubClassifier): GithubValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'github.com' || parts.length < 2) {
    throw new Error(`Unrecognized GitHub URL: ${url}`);
  }
  return { classifier: hint ?? 'user', handle: parts[1]! };
};

export type TwitterValue = { handle: string };

export const parseTwitterUrl = (url: string): TwitterValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  const host = parts[0]?.toLowerCase();
  if (host !== 'twitter.com' && host !== 'x.com') {
    throw new Error(`Unrecognized Twitter/X URL: ${url}`);
  }
  if (!parts[1]) throw new Error(`No handle in Twitter URL: ${url}`);
  return { handle: parts[1]!.replace(/^@/, '') };
};

export type TelegramValue = { handle: string };

export const parseTelegramUrl = (url: string): TelegramValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 't.me' || !parts[1]) {
    throw new Error(`Unrecognized Telegram URL: ${url}`);
  }
  return { handle: parts[1]!.replace(/^@/, '') };
};

// Best-effort URL canonicalization for `website` valueKey:
//  - lowercases the host
//  - strips protocol and www.
//  - drops trailing slash
//  - drops fragment
// (keeps the path + query for distinguishability)
export const canonicalUrl = (url: string): string => {
  const trimmed = stripQueryAndFragment(url).replace(/#.*$/, '');
  const noProtocol = stripWwwAndProtocol(trimmed);
  const [host, ...rest] = noProtocol.split('/');
  const path = rest.join('/');
  return path ? `${host!.toLowerCase()}/${trimSlashes(path)}` : host!.toLowerCase();
};
