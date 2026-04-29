import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseTwitterUrl, type TwitterValue } from '@template/shared/contact/parsers';
import { z } from 'zod';

const twitterStored = z.object({ handle: z.string().min(1) });

type TwitterInput = TwitterValue | { url: string };
const twitterInput: z.ZodType<TwitterInput> = z.union([
  z.object({ url: z.string().url() }),
  twitterStored,
]);

export const twitterDef: ContactTypeDef<TwitterInput, TwitterValue> = {
  inputSchema: twitterInput,
  parseInput: (input) => ('url' in input ? parseTwitterUrl(input.url) : input),
  valueSchema: twitterStored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://x.com/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Twitter / X', icon: 'Twitter' },
};
