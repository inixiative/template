import {
  type LensNarrowing,
  projectLens,
  toLensSelect,
  toSourceQueries,
} from '@inixiative/json-rules';

export const lensProjectionSourcesAndSelect = (lens: LensNarrowing) => ({
  project: projectLens(lens),
  sources: toSourceQueries(lens),
  select: toLensSelect(lens),
});
