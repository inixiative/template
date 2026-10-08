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
type SourceSpecShape = { where?: Condition; label?: string; groupBy?: string | string[] };

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

const mergeModel = (
  a: ModelDefaultNarrowing | undefined,
  b: ModelDefaultNarrowing,
): ModelDefaultNarrowing => {
  if (!a) return b;
  const where = both(a.where, b.where);
  const sources = mergeSources(a.sources, b.sources);
  return {
    ...a,
    ...b,
    ...(where === undefined ? {} : { where }),
    ...(sources ? { sources } : {}),
    ...(a.relations || b.relations ? { relations: { ...a.relations, ...b.relations } } : {}),
  };
};

const mergeDefaults = (
  a: NarrowingDefaults | undefined,
  b: NarrowingDefaults,
): NarrowingDefaults => {
  const models: Record<string, ModelDefaultNarrowing> = { ...a?.models };
  for (const [model, narrowing] of Object.entries(b.models ?? {}))
    models[model] = mergeModel(models[model], narrowing);
  return {
    ...a,
    ...b,
    models,
    ...(a?.enums || b.enums ? { enums: { ...a?.enums, ...b.enums } } : {}),
  };
};

const mergeMapDefaults = (a: MapDefaults | undefined, b: MapDefaults): MapDefaults => {
  const out: MapDefaults = { ...a };
  for (const [mapName, defaults] of Object.entries(b))
    out[mapName] = mergeDefaults(out[mapName], defaults);
  return out;
};

/** Grants that read what a narrowing hides belong in its first layer: later layers may only read what their parent shows. */
export const intoFirstLayer = (
  lens: Lens | LensNarrowing,
  mapDefaults: MapDefaults,
): LensNarrowing => {
  if (!('parent' in lens)) return { parent: lens, mapDefaults };
  if (!('parent' in lens.parent))
    return { ...lens, mapDefaults: mergeMapDefaults(lens.mapDefaults, mapDefaults) };
  return { ...lens, parent: intoFirstLayer(lens.parent, mapDefaults) };
};
