/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type TelegramValue = { handle: string };

export const parseTelegramUrl = (url: string): TelegramValue => ({
  handle: parseSimpleHandleUrl('t.me', url, { caseInsensitive: true }),
});
