/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type FieldMapEntry, type Lens, type LensNarrowing, projectByPath } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';

export type LensCursor = { key?: string; mapName: string; model: string };

export type LensHop = { field: FieldMapEntry; next: LensCursor };

export type LensFieldResolver = {
  start: LensCursor;
  resolve: (cursor: LensCursor, segment: string) => LensHop | undefined;
};

export const lensFieldResolver = (lens: Lens | LensNarrowing): LensFieldResolver => {
  const base = 'parent' in lens ? rootLens(lens) : lens;
  const byPath = projectByPath(lens);
  const [rootKey] = byPath.keys();
  const start: LensCursor = { key: rootKey, mapName: base.mapName, model: base.model };

  const resolve = (cursor: LensCursor, segment: string): LensHop | undefined => {
    const visit = cursor.key ? byPath.get(cursor.key) : undefined;
    const field = visit
      ? (visit.fields[segment] as FieldMapEntry | undefined)
      : base.maps[cursor.mapName]?.models[cursor.model]?.fields[segment];
    if (!field) return undefined;
    if ((field.kind !== 'object' && field.kind !== 'bridge') || !field.type) return { field, next: cursor };
    const [mapName, model] = field.type.includes(':') ? field.type.split(':') : [cursor.mapName, field.type];
    const childKey = cursor.key ? `${cursor.key}.${segment}` : undefined;
    return {
      field,
      next: { key: childKey && byPath.has(childKey) ? childKey : undefined, mapName: mapName!, model: model! },
    };
  };

  return { start, resolve };
};
