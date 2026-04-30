import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { type MastodonValue, parseMastodonUrl } from '@template/shared/contact/parsers/mastodon';
import { z } from 'zod';

const stored = z.object({ instance: z.string().min(1), handle: z.string().min(1) });
type Input = MastodonValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const mastodonDef: ContactTypeDef<Input, MastodonValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseMastodonUrl(i.url) : i),
  valueSchema: stored,
  // Mastodon is multi-instance — instance is part of identity.
  toValueKey: (v) => `${v.instance.toLowerCase()}/${v.handle.toLowerCase()}`,
  toUrl: (v) => `https://${v.instance}/@${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Mastodon', icon: 'simple-icons:mastodon' },
};
