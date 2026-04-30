import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type FacebookValue = { handle: string };

export const parseFacebookUrl = (url: string): FacebookValue => ({
  handle: parseSimpleHandleUrl('facebook.com', url),
});
