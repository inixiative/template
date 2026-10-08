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
type Clamps = Pick<ModelDefaultNarrowing, 'where' | 'sources'>;
type SourceSpecShape = { where?: Condition; label?: string; groupBy?: string | string[] };

export type FirstLayerClamps = {
  root?: Pick<ModelDefaultNarrowing, 'where'>;
  mapDefaults?: Record<string, { models: Record<string, Clamps> }>;
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

const withClamps = <N extends ModelDefaultNarrowing>(
  narrowing: N | undefined,
  clamps: Clamps,
): N => {
  const where = both(narrowing?.where, clamps.where);
  const sources = mergeSources(narrowing?.sources, clamps.sources);
  return {
    ...narrowing,
    ...(where === undefined ? {} : { where }),
    ...(sources ? { sources } : {}),
  } as N;
};

const mergeDefaults = (
  defaults: NarrowingDefaults | undefined,
  clamps: Record<string, Clamps>,
): NarrowingDefaults => {
  const models: Record<string, ModelDefaultNarrowing> = { ...defaults?.models };
  for (const [model, modelClamps] of Object.entries(clamps))
    models[model] = withClamps(models[model], modelClamps);
  return { ...defaults, models };
};

const mergeMapDefaults = (
  mapDefaults: MapDefaults | undefined,
  clamps: NonNullable<FirstLayerClamps['mapDefaults']>,
): MapDefaults => {
  const out: MapDefaults = { ...mapDefaults };
  for (const [mapName, { models }] of Object.entries(clamps))
    out[mapName] = mergeDefaults(out[mapName], models);
  return out;
};

const withFirstLayerClamps = (layer: LensNarrowing, clamps: FirstLayerClamps): LensNarrowing => ({
  ...layer,
  ...(clamps.root ? { root: withClamps(layer.root, clamps.root) } : {}),
  ...(clamps.mapDefaults
    ? { mapDefaults: mergeMapDefaults(layer.mapDefaults, clamps.mapDefaults) }
    : {}),
});

/** Clamps that read what a narrowing hides belong in its first layer: later layers may only read what their parent shows. Only clamps merge, so nothing here widens a layer. */
export const intoFirstLayer = (
  lens: Lens | LensNarrowing,
  clamps: FirstLayerClamps,
): LensNarrowing => {
  if (!('parent' in lens)) return withFirstLayerClamps({ parent: lens }, clamps);
  if (!('parent' in lens.parent)) return withFirstLayerClamps(lens, clamps);
  return { ...lens, parent: intoFirstLayer(lens.parent, clamps) };
};
