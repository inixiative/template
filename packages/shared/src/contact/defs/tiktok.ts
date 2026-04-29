import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseTiktokUrl, type TiktokValue } from '@template/shared/contact/parsers/tiktok';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = TiktokValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const tiktokDef: ContactTypeDef<Input, TiktokValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseTiktokUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://tiktok.com/@${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'TikTok', icon: 'Music2' },
};
