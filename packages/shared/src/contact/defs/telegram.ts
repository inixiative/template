import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseTelegramUrl, type TelegramValue } from '@template/shared/contact/parsers';
import { z } from 'zod';

const telegramStored = z.object({ handle: z.string().min(1) });

type TelegramInput = TelegramValue | { url: string };
const telegramInput: z.ZodType<TelegramInput> = z.union([
  z.object({ url: z.string().url() }),
  telegramStored,
]);

export const telegramDef: ContactTypeDef<TelegramInput, TelegramValue> = {
  inputSchema: telegramInput,
  parseInput: (input) => ('url' in input ? parseTelegramUrl(input.url) : input),
  valueSchema: telegramStored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://t.me/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Telegram' },
};
