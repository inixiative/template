/**
 * @atlas
 * @kind constant, definition
 * @partOf primitive:shared
 * @uses none
 */
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

// Skype: identifier is a Skype Name / username; no reliable public URL.
export type SkypeValue = { handle: string };

const stored = z.object({ handle: z.string().min(1) });

export const skypeDef: ContactTypeDef<SkypeValue, SkypeValue> = {
  inputSchema: stored,
  parseInput: (v) => v,
  valueSchema: stored,
  toValueKey: (v) => v.handle.toLowerCase(),
  redact: (id) => ({ handle: id }),
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Skype', icon: 'simple-icons:skype' },
};
