import type { LensNarrowing } from '@inixiative/json-rules';

export const widen = (filterLens: LensNarrowing): LensNarrowing => ({
  parent: filterLens,
  root: { picks: ['name'] },
});
