import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseThreadsUrl, type ThreadsValue } from '@template/shared/contact/parsers/threads';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = ThreadsValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const threadsDef: ContactTypeDef<Input, ThreadsValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseThreadsUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://threads.net/@${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Threads', icon: 'AtSign' },
};
