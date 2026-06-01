import type { LensNarrowing } from '@inixiative/json-rules';

// Allowed: compose by nesting — the previous narrowing becomes the new parent.
export const widen = (filterLens: LensNarrowing): LensNarrowing => ({
  parent: filterLens,
  root: { picks: ['name'] },
});
