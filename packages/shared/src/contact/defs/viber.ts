import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

// Viber identifies users by phone number; no public profile URL.
export type ViberValue = { handle: string };

const stored = z.object({ handle: z.string().min(1) });

export const viberDef: ContactTypeDef<ViberValue, ViberValue> = {
  inputSchema: stored,
  parseInput: (v) => v,
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Viber', icon: 'Phone' },
};
