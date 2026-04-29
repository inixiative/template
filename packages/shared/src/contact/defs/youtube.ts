import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { parseYoutubeUrl, type YoutubeValue } from '@template/shared/contact/parsers/youtube';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = YoutubeValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const youtubeDef: ContactTypeDef<Input, YoutubeValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseYoutubeUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://youtube.com/@${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'YouTube', icon: 'simple-icons:youtube' },
};
