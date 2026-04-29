import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

// LINE: identifier is a username/ID; no canonical public profile URL.
export type LineValue = { handle: string };

const stored = z.object({ handle: z.string().min(1) });

export const lineDef: ContactTypeDef<LineValue, LineValue> = {
  inputSchema: stored,
  parseInput: (v) => v,
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'LINE', icon: 'MessageCircle' },
};
