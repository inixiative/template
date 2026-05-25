import type { Condition, LensNarrowing, MapNarrowing, ModelNarrowing } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';

export type WhereScope = {
  where?: Condition;
  relations?: Record<string, Condition>;
  defaults?: Record<string, Condition>;
};

const andWheres = (a: Condition | undefined, b: Condition): Condition => (a === undefined ? b : { all: [a, b] });

const mergeRelations = (
  rootModel: string,
  map: MapNarrowing,
  relations: Record<string, Condition>,
): MapNarrowing => {
  const existingRoot: ModelNarrowing = map.models[rootModel] ?? {};
  const existingRelations = existingRoot.relations ?? {};
  const nextRelations: Record<string, ModelNarrowing> = { ...existingRelations };
  for (const [relName, where] of Object.entries(relations)) {
    const existingRel = nextRelations[relName] ?? {};
    nextRelations[relName] = { ...existingRel, where: andWheres(existingRel.where, where) };
  }
  return {
    ...map,
    models: { ...map.models, [rootModel]: { ...existingRoot, relations: nextRelations } },
  };
};

const mergeDefaults = (map: MapNarrowing, defaults: Record<string, Condition>): MapNarrowing => {
  const existingDefaultsModels = map.defaults?.models ?? {};
  const nextDefaultsModels: Record<string, ModelNarrowing> = { ...existingDefaultsModels };
  for (const [modelName, where] of Object.entries(defaults)) {
    const existing = nextDefaultsModels[modelName] ?? {};
    nextDefaultsModels[modelName] = { ...existing, where: andWheres(existing.where, where) };
  }
  return {
    ...map,
    defaults: { ...(map.defaults ?? {}), models: nextDefaultsModels },
  };
};

export const mergeNarrowingWheres = (narrowing: LensNarrowing, scope: WhereScope): LensNarrowing => {
  const rootModel = rootLens(narrowing).model;
  const nextMaps: Record<string, MapNarrowing> = {};
  for (const [mapName, map] of Object.entries(narrowing.maps)) {
    let next = map;
    if (scope.relations) next = mergeRelations(rootModel, next, scope.relations);
    if (scope.defaults) next = mergeDefaults(next, scope.defaults);
    nextMaps[mapName] = next;
  }
  return {
    ...narrowing,
    where: scope.where ? andWheres(narrowing.where, scope.where) : narrowing.where,
    maps: nextMaps,
  };
};
