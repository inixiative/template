/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 */
// Shared URL helpers for handle-type contact parsers. Each per-type parser
// file under `parsers/` consumes these to peel a URL down to its handle.

export const stripQueryAndFragment = (s: string): string => s.split('?')[0]!.split('#')[0]!;

export const trimSlashes = (s: string): string => s.replace(/^\/+|\/+$/g, '');

export const stripWwwAndProtocol = (url: string): string => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

export const splitUrl = (url: string): string[] =>
  trimSlashes(stripQueryAndFragment(stripWwwAndProtocol(url)))
    .split('/')
    .filter(Boolean);

export type ParseSimpleHandleUrlOptions = {
  prefix?: string | readonly string[];
  caseInsensitive?: boolean;
};

export const parseSimpleHandleUrl = (
  hosts: string | readonly string[],
  url: string,
  options: ParseSimpleHandleUrlOptions = {},
): string => {
  const { prefix, caseInsensitive = true } = options;
  const parts = splitUrl(url);
  const hostList = (typeof hosts === 'string' ? [hosts] : hosts).map((h) => h.toLowerCase());
  if (!parts[0] || !hostList.includes(parts[0].toLowerCase())) {
    throw new Error(`Unrecognized ${hostList[0]} URL: ${url}`);
  }
  const normalize = (s: string) => (caseInsensitive ? s.toLowerCase() : s);

  if (prefix !== undefined) {
    const prefixList = (typeof prefix === 'string' ? [prefix] : prefix).map((p) => p.toLowerCase());
    if (!parts[1] || !prefixList.includes(parts[1].toLowerCase()) || !parts[2]) {
      throw new Error(`Expected ${hostList[0]}/(${prefixList.join('|')})/<handle>: ${url}`);
    }
    return normalize(parts[2]!.replace(/^@/, ''));
  }
  if (!parts[1]) throw new Error(`No handle in ${hostList[0]} URL: ${url}`);
  return normalize(parts[1]!.replace(/^@/, ''));
};

export const canonicalUrl = (url: string): string => {
  const trimmed = stripQueryAndFragment(url).replace(/#.*$/, '');
  const noProtocol = stripWwwAndProtocol(trimmed);
  const [host, ...rest] = noProtocol.split('/');
  const path = rest.join('/');
  return path ? `${host!.toLowerCase()}/${trimSlashes(path)}` : host!.toLowerCase();
};
