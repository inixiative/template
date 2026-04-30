// Shared URL helpers for handle-type contact parsers. Each per-type parser
// file under `parsers/` consumes these to peel a URL down to its handle.

export const stripQueryAndFragment = (s: string): string => s.split('?')[0]!.split('#')[0]!;

export const trimSlashes = (s: string): string => s.replace(/^\/+|\/+$/g, '');

export const stripWwwAndProtocol = (url: string): string => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

export const splitUrl = (url: string): string[] =>
  trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)))
    .split('/')
    .filter(Boolean);

/**
 * Parse a `host/handle` or `host/<prefix>/handle` URL into its trailing handle.
 *
 * @param hosts  one or more accepted hosts (e.g. ['twitter.com', 'x.com'])
 * @param url    URL to parse
 * @param prefix optional path segment between host and handle (e.g. 'profile'
 *               for `bsky.app/profile/<handle>`). Pass undefined for direct.
 */
export const parseSimpleHandleUrl = (hosts: string | readonly string[], url: string, prefix?: string): string => {
  const parts = splitUrl(url);
  const hostList = (typeof hosts === 'string' ? [hosts] : hosts).map((h) => h.toLowerCase());
  if (!parts[0] || !hostList.includes(parts[0].toLowerCase())) {
    throw new Error(`Unrecognized ${hostList[0]} URL: ${url}`);
  }
  if (prefix !== undefined) {
    if (parts[1]?.toLowerCase() !== prefix.toLowerCase() || !parts[2]) {
      throw new Error(`Expected ${hostList[0]}/${prefix}/<handle>: ${url}`);
    }
    return parts[2]!.replace(/^@/, '');
  }
  if (!parts[1]) throw new Error(`No handle in ${hostList[0]} URL: ${url}`);
  return parts[1]!.replace(/^@/, '');
};

/**
 * Best-effort URL canonicalization for `website` valueKey. Lowercases host,
 * strips protocol + `www.` + trailing slash + fragment. Keeps path + query.
 */
export const canonicalUrl = (url: string): string => {
  const trimmed = stripQueryAndFragment(url).replace(/#.*$/, '');
  const noProtocol = stripWwwAndProtocol(trimmed);
  const [host, ...rest] = noProtocol.split('/');
  const path = rest.join('/');
  return path ? `${host!.toLowerCase()}/${trimSlashes(path)}` : host!.toLowerCase();
};
