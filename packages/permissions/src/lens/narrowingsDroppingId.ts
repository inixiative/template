/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses none
 */
import type { Lens, LensNarrowing, ModelNarrowing } from '@inixiative/json-rules';
import {
  fieldOf,
  hasIdField,
  type LensModel,
  relationTargetOf,
  rootModelOf,
} from '@template/permissions/lens/lensModels';

/** An entitlement's stored lens: one json-rules narrowing over the resource's base lens, its parent implied. */
export type EntitlementLens = Pick<LensNarrowing, 'root' | 'mapDefaults'>;

const dropsId = ({ picks, omits }: ModelNarrowing): boolean =>
  (Array.isArray(omits) && omits.includes('id')) || (Array.isArray(picks) && !picks.includes('id'));

const collect = (
  base: Lens,
  at: LensModel,
  narrowing: ModelNarrowing,
  label: string,
  found: string[],
): void => {
  if (hasIdField(base, at) && dropsId(narrowing)) found.push(label);
  for (const [relation, below] of Object.entries(narrowing.relations ?? {})) {
    const entry = fieldOf(base, at, relation);
    const target = entry ? relationTargetOf(entry, at.mapName) : null;
    if (target) collect(base, target, below, `${label}.relations.${relation}`, found);
  }
};

/**
 * Every narrowing of `lens` that omits `id`, or picks without it, on a model whose field map has
 * an `id`: the root, each nested relation, and each `mapDefaults` model. Empty when the lens keeps
 * `id` everywhere, which is what lets projections through different lenses be merged by `id`.
 */
export const narrowingsDroppingId = (base: Lens, lens: EntitlementLens): string[] => {
  const found: string[] = [];
  if (lens.root) collect(base, rootModelOf(base), lens.root, 'root', found);
  for (const [mapName, defaults] of Object.entries(lens.mapDefaults ?? {}))
    for (const [modelName, narrowing] of Object.entries(defaults.models ?? {}))
      collect(
        base,
        { mapName, modelName },
        narrowing,
        `mapDefaults.${mapName}.models.${modelName}`,
        found,
      );
  return found;
};
