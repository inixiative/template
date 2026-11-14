/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { getLensRoot, type Lens, type LensNarrowing } from '@inixiative/json-rules';

/** Whether a visited model's field map has an `id` column: the models whose objects merge by `id`. */
export const modelHasId = (
  lens: Lens | LensNarrowing,
  { mapName, model }: { mapName: string; model: string },
): boolean => getLensRoot(lens).maps[mapName]?.models[model]?.fields.id?.kind === 'scalar';
