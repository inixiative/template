/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 */
import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type RedditValue = { handle: string };

// Reddit accepts both /u/<name> and /user/<name>; usernames case-insensitive.
export const parseRedditUrl = (url: string): RedditValue => ({
  handle: parseSimpleHandleUrl('reddit.com', url, { prefix: ['u', 'user'], caseInsensitive: true }),
});
