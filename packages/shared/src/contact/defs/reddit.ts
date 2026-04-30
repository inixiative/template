import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseRedditUrl, type RedditValue } from '@template/shared/contact/parsers/reddit';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = RedditValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const redditDef: ContactTypeDef<Input, RedditValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseRedditUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://reddit.com/user/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Reddit', icon: 'simple-icons:reddit' },
};
