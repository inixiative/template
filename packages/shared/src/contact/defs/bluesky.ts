import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { type BlueskyValue, parseBlueskyUrl } from '@template/shared/contact/parsers/bluesky';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = BlueskyValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const blueskyDef: ContactTypeDef<Input, BlueskyValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseBlueskyUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://bsky.app/profile/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Bluesky', icon: 'simple-icons:bluesky' },
};
