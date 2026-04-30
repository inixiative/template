import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type InstagramValue = { handle: string };

export const parseInstagramUrl = (url: string): InstagramValue => ({
  handle: parseSimpleHandleUrl('instagram.com', url),
});
