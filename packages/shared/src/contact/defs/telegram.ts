/**
 * @atlas
 * @kind constant, definition
 * @partOf primitive:shared
 * @uses none
 */
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseTelegramUrl, type TelegramValue } from '@template/shared/contact/parsers';
import { stubEmailDomain } from '@template/shared/contact/stubEmail';
import { z } from 'zod';

const telegramStored = z.object({ handle: z.string().min(1) });

type TelegramInput = TelegramValue | { url: string };
const telegramInput: z.ZodType<TelegramInput> = z.union([z.object({ url: z.string().url() }), telegramStored]);

export const telegramDef: ContactTypeDef<TelegramInput, TelegramValue> = {
  inputSchema: telegramInput,
  parseInput: (input) => ('url' in input ? parseTelegramUrl(input.url) : input),
  valueSchema: telegramStored,
  toValueKey: (v) => v.handle.toLowerCase(),
  redact: (id) => ({ handle: id }),
  toUrl: (v) => `https://t.me/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Telegram', icon: 'simple-icons:telegram' },
  // Telegram identity is the handle (username), not a phone — so the stub
  // email is `${handle}@telegram.${PROJECT_NAME}` rather than going through
  // phoneToStubEmail. If we ever observe phone-numbered TG accounts
  // (no username set), revisit the value shape.
  toStubEmail: (v) => `${v.handle.toLowerCase()}@${stubEmailDomain('telegram')}`,
};
