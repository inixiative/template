import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type RedditValue = { handle: string };

// Reddit user URLs use /user/<name> or /u/<name>; canonical /user/.
export const parseRedditUrl = (url: string): RedditValue => ({
  handle: parseSimpleHandleUrl('reddit.com', url, 'user'),
});
