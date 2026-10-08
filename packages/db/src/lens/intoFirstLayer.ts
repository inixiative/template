/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import type {
  Condition,
  Lens,
  LensNarrowing,
  ModelDefaultNarrowing,
  NarrowingDefaults,
  SourceEntry,
} from '@inixiative/json-rules';

type MapDefaults = NonNullable<LensNarrowing['mapDefaults']>;
type Grants = Pick<ModelDefaultNarrowing, 'where' | 'sources'>;
type SourceSpecShape = { where?: Condition; label?: string; groupBy?: string | string[] };

export type FirstLayerGrants = {
  root?: Pick<ModelDefaultNarrowing, 'where'>;
  mapDefaults?: Record<string, { models: Record<string, Grants> }>;
};

const SPEC_KEYS = ['where', 'label', 'groupBy', 'from'];

const asSpec = (entry: SourceEntry): SourceSpecShape =>
  typeof entry === 'object' &&
  entry !== null &&
  !Array.isArray(entry) &&
  Object.keys(entry).every((key) => SPEC_KEYS.includes(key))
    ? (entry as SourceSpecShape)
    : { where: entry as Condition };

const both = (a?: Condition, b?: Condition): Condition | undefined =>
  a === undefined ? b : b === undefined ? a : { all: [a, b] };

const mergeSources = (
  a: ModelDefaultNarrowing['sources'],
  b: ModelDefaultNarrowing['sources'],
): ModelDefaultNarrowing['sources'] => {
  if (!a || !b) return a ?? b;
  const out: Record<string, SourceEntry> = { ...a };
  for (const [field, entry] of Object.entries(b)) {
    const prior = out[field];
    if (prior === undefined) {
      out[field] = entry;
      continue;
    }
    const left = asSpec(prior);
    const right = asSpec(entry);
    const where = both(left.where, right.where);
    out[field] = { ...left, ...right, ...(where === undefined ? {} : { where }) } as SourceEntry;
  }
  return out;
};

const withGrants = <N extends ModelDefaultNarrowing>(
  narrowing: N | undefined,
  grants: Grants,
): N => {
  const where = both(narrowing?.where, grants.where);
  const sources = mergeSources(narrowing?.sources, grants.sources);
  return {
    ...narrowing,
    ...(where === undefined ? {} : { where }),
    ...(sources ? { sources } : {}),
  } as N;
};

const mergeDefaults = (
  defaults: NarrowingDefaults | undefined,
  grants: Record<string, Grants>,
): NarrowingDefaults => {
  const models: Record<string, ModelDefaultNarrowing> = { ...defaults?.models };
  for (const [model, modelGrants] of Object.entries(grants))
    models[model] = withGrants(models[model], modelGrants);
  return { ...defaults, models };
};

const mergeMapDefaults = (
  mapDefaults: MapDefaults | undefined,
  grants: NonNullable<FirstLayerGrants['mapDefaults']>,
): MapDefaults => {
  const out: MapDefaults = { ...mapDefaults };
  for (const [mapName, { models }] of Object.entries(grants))
    out[mapName] = mergeDefaults(out[mapName], models);
  return out;
};

const withFirstLayerGrants = (layer: LensNarrowing, grants: FirstLayerGrants): LensNarrowing => ({
  ...layer,
  ...(grants.root ? { root: withGrants(layer.root, grants.root) } : {}),
  ...(grants.mapDefaults
    ? { mapDefaults: mergeMapDefaults(layer.mapDefaults, grants.mapDefaults) }
    : {}),
});

/** Grants that read what a narrowing hides belong in its first layer: later layers may only read what their parent shows. Only grants merge, so nothing here widens a layer. */
export const intoFirstLayer = (
  lens: Lens | LensNarrowing,
  grants: FirstLayerGrants,
): LensNarrowing => {
  if (!('parent' in lens)) return withFirstLayerGrants({ parent: lens }, grants);
  if (!('parent' in lens.parent)) return withFirstLayerGrants(lens, grants);
  return { ...lens, parent: intoFirstLayer(lens.parent, grants) };
};
