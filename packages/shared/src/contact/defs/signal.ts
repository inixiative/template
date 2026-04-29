import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

// Signal identifies users by phone number or username — no public URL form.
export type SignalValue = { handle: string };

const stored = z.object({ handle: z.string().min(1) });

export const signalDef: ContactTypeDef<SignalValue, SignalValue> = {
  inputSchema: stored,
  parseInput: (v) => v,
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Signal', icon: 'Signal' },
};
