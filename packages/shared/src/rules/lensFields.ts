/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
import {
  type FieldKind,
  type FieldMapEntry,
  type Lens,
  type LensNarrowing,
  projectLens,
} from '@inixiative/json-rules';

export type LensField = {
  path: string;
  model: string;
  kind: FieldKind | 'relation';
  type: string;
  isList: boolean;
  values: string[];
  sourced: boolean;
};

const fieldKind = (entry: FieldMapEntry): LensField['kind'] => {
  if (entry.kind === 'object' || entry.kind === 'bridge') return 'relation';
  if (entry.kind === 'enum') return 'Enum';
  return entry.type as FieldKind;
};

export const lensFields = (lens: Lens | LensNarrowing): LensField[] =>
  Object.entries(projectLens(lens)).flatMap(([visitPath, visit]) => {
    const relationPath = visitPath.split('.').slice(1);
    return Object.entries(visit.fields).map(([field, entry]) => ({
      path: [...relationPath, field].join('.'),
      model: visit.model,
      kind: fieldKind(entry),
      type: entry.type,
      isList: entry.isList ?? false,
      values: [...(entry.values ?? [])],
      sourced: field in visit.sources,
    }));
  });
