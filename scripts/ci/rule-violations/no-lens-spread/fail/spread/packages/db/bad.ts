import type { LensNarrowing } from '@inixiative/json-rules';

export const widen = (filterLens: LensNarrowing): LensNarrowing => ({
  ...filterLens,
  root: { picks: ['name'] },
});
