import type { LensNarrowing } from '@inixiative/json-rules';

// Forbidden: spreading the narrowing flattens the parent chain and drops layers.
export const widen = (filterLens: LensNarrowing): LensNarrowing => ({
  ...filterLens,
  root: { picks: ['name'] },
});
