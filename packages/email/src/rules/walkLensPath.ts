/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type FieldMapEntry, projectByPath } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';
import type { RuleLens } from '@template/shared/rules';

export type LensPathWalk =
  | { outcome: 'resolved' }
  | { outcome: 'missing'; index: number }
  | { outcome: 'beneathJson'; index: number }
  | { outcome: 'pastScalar'; index: number };

/**
 * The field each segment of a dotted path lands on: a narrowed hop is read off the lens projection
 * (what the narrowing exposes), a hop the projection does not enumerate — a bare lens exposes
 * everything reachable — off the base map. Stops at the first miss or scalar.
 */
export const lensPathFields = (path: string, lens: RuleLens): FieldMapEntry[] => {
  const base = 'parent' in lens ? rootLens(lens) : lens;
  const byPath = projectByPath(lens);
  let key: string | undefined = byPath.keys().next().value as string;
  let { mapName, model } = base;
  const fields: FieldMapEntry[] = [];
  for (const segment of path.split('.')) {
    const field = (key ? byPath.get(key)?.fields[segment] : base.maps[mapName]?.models[model]?.fields[segment]) as
      | FieldMapEntry
      | undefined;
    if (!field) break;
    fields.push(field);
    if ((field.kind !== 'object' && field.kind !== 'bridge') || !field.type) break;
    [mapName, model] = field.type.includes(':') ? (field.type.split(':') as [string, string]) : [mapName, field.type];
    const child: string | undefined = key ? `${key}.${segment}` : undefined;
    key = child && byPath.has(child) ? child : undefined;
  }
  return fields;
};

export const walkLensPath = (path: string, lens: RuleLens): LensPathWalk => {
  const fields = lensPathFields(path, lens);
  const segments = path.split('.');
  for (let i = 0; i < segments.length; i++) {
    const field = fields[i];
    if (!field) return { outcome: 'missing', index: i };
    const last = i === segments.length - 1;
    if (field.kind === 'scalar' && field.type === 'Json')
      return last ? { outcome: 'resolved' } : { outcome: 'beneathJson', index: i };
    if (field.kind === 'object' || field.kind === 'bridge') continue;
    if (!last) return { outcome: 'pastScalar', index: i };
  }
  return { outcome: 'resolved' };
};
