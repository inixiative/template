import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type BlueskyValue = { handle: string };

// Bluesky: bsky.app/profile/<handle>
export const parseBlueskyUrl = (url: string): BlueskyValue => ({
  handle: parseSimpleHandleUrl('bsky.app', url, 'profile'),
});
