import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { type InstagramValue, parseInstagramUrl } from '@template/shared/contact/parsers/instagram';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = InstagramValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const instagramDef: ContactTypeDef<Input, InstagramValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseInstagramUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://instagram.com/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Instagram', icon: 'Instagram' },
};
