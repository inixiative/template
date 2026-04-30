import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type TiktokValue = { handle: string };

export const parseTiktokUrl = (url: string): TiktokValue => ({
  handle: parseSimpleHandleUrl('tiktok.com', url),
});
