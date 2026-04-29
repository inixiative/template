import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type TwitterValue = { handle: string };

export const parseTwitterUrl = (url: string): TwitterValue => ({
  handle: parseSimpleHandleUrl(['twitter.com', 'x.com'], url),
});
