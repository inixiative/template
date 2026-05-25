import type {
  Condition,
  LensNarrowing,
  ModelDefaultNarrowing,
  ModelNarrowing,
  NarrowingDefaults,
} from '@inixiative/json-rules';

export type RootWhereScope = {
  where?: Condition;
  relations?: Record<string, RootWhereScope>;
};

export type WhereScope = {
  root?: RootWhereScope;
  mapDefaults?: Record<string, { models?: Record<string, { where?: Condition }> }>;
};

const andWheres = (a: Condition | undefined, b: Condition): Condition => (a === undefined ? b : { all: [a, b] });

const mergeRootWhere = (current: ModelNarrowing | undefined, scope: RootWhereScope): ModelNarrowing => {
  const next: ModelNarrowing = { ...(current ?? {}) };
  if (scope.where !== undefined) next.where = andWheres(next.where, scope.where);
  if (scope.relations) {
    const existingRelations = next.relations ?? {};
    const nextRelations: Record<string, ModelNarrowing> = { ...existingRelations };
    for (const [relName, sub] of Object.entries(scope.relations)) {
      nextRelations[relName] = mergeRootWhere(existingRelations[relName], sub);
    }
    next.relations = nextRelations;
  }
  return next;
};

const mergeMapDefaults = (
  current: NarrowingDefaults | undefined,
  scope: { models?: Record<string, { where?: Condition }> },
): NarrowingDefaults => {
  const next: NarrowingDefaults = { ...(current ?? {}) };
  if (scope.models) {
    const existingModels = next.models ?? {};
    const nextModels: Record<string, ModelDefaultNarrowing> = { ...existingModels };
    for (const [modelName, { where }] of Object.entries(scope.models)) {
      if (where === undefined) continue;
      const existing = existingModels[modelName] ?? {};
      nextModels[modelName] = { ...existing, where: andWheres(existing.where, where) };
    }
    next.models = nextModels;
  }
  return next;
};

export const mergeNarrowingWheres = (narrowing: LensNarrowing, scope: WhereScope): LensNarrowing => {
  const next: LensNarrowing = { ...narrowing };
  if (scope.root) next.root = mergeRootWhere(narrowing.root, scope.root);
  if (scope.mapDefaults) {
    const existing = narrowing.mapDefaults ?? {};
    const nextMapDefaults: Record<string, NarrowingDefaults> = { ...existing };
    for (const [mapName, mapScope] of Object.entries(scope.mapDefaults)) {
      nextMapDefaults[mapName] = mergeMapDefaults(existing[mapName], mapScope);
    }
    next.mapDefaults = nextMapDefaults;
  }
  return next;
};
