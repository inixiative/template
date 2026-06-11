/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 */
import { splitUrl } from '@template/shared/contact/parsers/url';

export type MastodonValue = { instance: string; handle: string };

// Multi-instance — host varies. Format: <instance>/@<handle>.
export const parseMastodonUrl = (url: string): MastodonValue => {
  const parts = splitUrl(url);
  if (!parts[0] || !parts[1]?.startsWith('@')) {
    throw new Error(`Unrecognized Mastodon URL: ${url}`);
  }
  // Mastodon usernames are case-insensitive (server-side lookup normalises).
  return { instance: parts[0].toLowerCase(), handle: parts[1].slice(1).toLowerCase() };
};
