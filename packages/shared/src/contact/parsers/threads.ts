import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type ThreadsValue = { handle: string };

export const parseThreadsUrl = (url: string): ThreadsValue => ({
  handle: parseSimpleHandleUrl('threads.net', url),
});
