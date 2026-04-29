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

export type InstagramValue = { handle: string };
export const parseInstagramUrl = (url: string): InstagramValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'instagram.com' || !parts[1])
    throw new Error(`Unrecognized Instagram URL: ${url}`);
  return { handle: parts[1]! };
};

export type FacebookValue = { handle: string };
export const parseFacebookUrl = (url: string): FacebookValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'facebook.com' || !parts[1])
    throw new Error(`Unrecognized Facebook URL: ${url}`);
  return { handle: parts[1]! };
};

export type YoutubeValue = { handle: string };
export const parseYoutubeUrl = (url: string): YoutubeValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'youtube.com' || !parts[1])
    throw new Error(`Unrecognized YouTube URL: ${url}`);
  const seg = parts[1]!;
  if (seg.startsWith('@')) return { handle: seg.slice(1) };
  if ((seg === 'c' || seg === 'user') && parts[2]) return { handle: parts[2]! };
  if (seg === 'channel') throw new Error('YouTube channel IDs are not supported; use the @handle URL');
  return { handle: seg };
};

export type TiktokValue = { handle: string };
export const parseTiktokUrl = (url: string): TiktokValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'tiktok.com' || !parts[1])
    throw new Error(`Unrecognized TikTok URL: ${url}`);
  return { handle: parts[1]!.replace(/^@/, '') };
};

export type BlueskyValue = { handle: string };
export const parseBlueskyUrl = (url: string): BlueskyValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'bsky.app' || parts[1] !== 'profile' || !parts[2])
    throw new Error(`Unrecognized Bluesky URL: ${url}`);
  return { handle: parts[2]! };
};

export type ThreadsValue = { handle: string };
export const parseThreadsUrl = (url: string): ThreadsValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'threads.net' || !parts[1])
    throw new Error(`Unrecognized Threads URL: ${url}`);
  return { handle: parts[1]!.replace(/^@/, '') };
};

export type RedditValue = { handle: string };
export const parseRedditUrl = (url: string): RedditValue => {
  const stripped = trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)));
  const parts = stripped.split('/').filter(Boolean);
  if (
    parts[0]?.toLowerCase() !== 'reddit.com' ||
    (parts[1] !== 'u' && parts[1] !== 'user') ||
    !parts[2]
  )
    throw new Error(`Unrecognized Reddit URL: ${url}`);
  return { handle: parts[2]! };
};

export type MastodonValue = { handle: string; server: string };
export const parseMastodonHandle = (input: string): MastodonValue => {
  // @handle@server.tld or handle@server.tld
  const normalized = input.replace(/^@/, '');
  const atIdx = normalized.indexOf('@');
  if (atIdx > 0) {
    return { handle: normalized.slice(0, atIdx), server: normalized.slice(atIdx + 1).toLowerCase() };
  }
  // https://server.tld/@handle
  const stripped = trimSlashes(stripQueryAndFragment(input.replace(/^https?:\/\//i, '')));
  const parts = stripped.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error(`Unrecognized Mastodon input: ${input}`);
  const handlePart = parts[1]!.replace(/^@/, '');
  if (!handlePart) throw new Error(`Unrecognized Mastodon input: ${input}`);
  return { handle: handlePart, server: parts[0]!.toLowerCase() };
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
