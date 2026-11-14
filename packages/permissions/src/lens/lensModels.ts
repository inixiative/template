/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import type { FieldMapEntry, Lens } from '@inixiative/json-rules';

export type LensModel = { mapName: string; modelName: string };

const own = <T>(record: Record<string, T> | undefined, key: string): T | undefined =>
  record && Object.hasOwn(record, key) ? record[key] : undefined;

export const rootModelOf = (base: Lens): LensModel => ({
  mapName: base.mapName,
  modelName: base.model,
});

export const fieldsOf = (
  base: Lens,
  { mapName, modelName }: LensModel,
): Record<string, FieldMapEntry> => own(own(base.maps, mapName)?.models, modelName)?.fields ?? {};

export const fieldOf = (base: Lens, at: LensModel, field: string): FieldMapEntry | undefined =>
  own(fieldsOf(base, at), field);

/** The model a relation leads to, as json-rules reads it: an `object` in the same map, a `bridge` named `map:Model`. */
export const relationTargetOf = (entry: FieldMapEntry, mapName: string): LensModel | null => {
  if (entry.kind === 'object') return { mapName, modelName: entry.type };
  if (entry.kind !== 'bridge') return null;
  const at = entry.type.indexOf(':');
  return at === -1
    ? { mapName, modelName: entry.type }
    : { mapName: entry.type.slice(0, at), modelName: entry.type.slice(at + 1) };
};

export const hasIdField = (base: Lens, at: LensModel): boolean => {
  const id = fieldOf(base, at, 'id');
  return id !== undefined && relationTargetOf(id, at.mapName) === null;
};
