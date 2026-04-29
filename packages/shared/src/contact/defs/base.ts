import type { z } from 'zod';

export type ContactSubtypeRule =
  | { mode: 'forbidden' }
  | { mode: 'optional'; values: readonly string[] }
  | { mode: 'required'; values: readonly string[] };

export type ContactTypeDef<TInput, TStored> = {
  // Loose schema accepting URL paste, structured input, etc.
  inputSchema: z.ZodType<TInput>;
  // Normalize loose input → strict canonical storage shape.
  parseInput: (input: TInput) => TStored;
  // Strict schema for the canonical stored shape (post-parse safety net).
  valueSchema: z.ZodType<TStored>;
  // Canonical projection used for indexing + uniqueness lookups.
  toValueKey: (v: TStored) => string;
  // Display-time URL reconstruction (handle types only).
  toUrl?: (v: TStored) => string;
  subtype: ContactSubtypeRule;
  uniqueness: 'global-within-type' | 'per-owner';
  // `icon` is an iconify slug (e.g. `lucide:phone`, `simple-icons:linkedin`).
  // UI passes it straight to <Icon icon={…} /> — keeps shared react-free.
  display: { label: string; icon: string };
};
