import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { type FacebookValue, parseFacebookUrl } from '@template/shared/contact/parsers/facebook';
import { z } from 'zod';

const stored = z.object({ handle: z.string().min(1) });
type Input = FacebookValue | { url: string };
const input: z.ZodType<Input> = z.union([z.object({ url: z.string().url() }), stored]);

export const facebookDef: ContactTypeDef<Input, FacebookValue> = {
  inputSchema: input,
  parseInput: (i) => ('url' in i ? parseFacebookUrl(i.url) : i),
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://facebook.com/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Facebook', icon: 'Facebook' },
};
