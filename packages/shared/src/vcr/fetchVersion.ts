/**
 * @atlas
 * @partOf primitive:shared
 */
// Resolve a version string by fetching a URL. Used as the VCR version
// callback for third-party APIs that ship neither SDK nor CLI we can
// version-stamp directly. Caller picks the URL — typically:
//   - the docs page for the exact endpoint being wrapped (changes when the
//     contract shifts)
//   - an OpenAPI spec URL
//   - a /version or /health endpoint if the API exposes one
//
// Three extraction strategies, in priority order:
//   - extract(res): custom callback, escape hatch for anything else
//   - header:       pull a response header (etag, last-modified, x-api-version)
//   - default:      GET body, sha256-hash, return first 12 hex chars

type FetchVersionOptions = {
  init?: RequestInit;
  header?: string;
  extract?: (res: Response) => string | Promise<string>;
};

export const fetchVersion = async (url: string, opts: FetchVersionOptions = {}): Promise<string> => {
  const res = await fetch(url, { redirect: 'follow', ...opts.init });
  if (!res.ok) throw new Error(`fetchVersion(${url}): ${res.status} ${res.statusText}`);

  if (opts.extract) return opts.extract(res);

  if (opts.header) {
    const value = res.headers.get(opts.header);
    if (!value) throw new Error(`fetchVersion(${url}): header "${opts.header}" missing`);
    return value.replace(/"/g, '');
  }

  const text = await res.text();
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(text);
  return hasher.digest('hex').slice(0, 12);
};
