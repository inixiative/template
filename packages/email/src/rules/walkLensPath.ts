/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type FieldMapEntry, resolveLensPath } from '@inixiative/json-rules';
import type { RuleLens } from '@template/shared/rules';

export type LensPathWalk =
  | { outcome: 'resolved' }
  | { outcome: 'missing'; index: number }
  | { outcome: 'beneathJson'; index: number }
  | { outcome: 'pastScalar'; index: number };

/** The field each segment of a dotted path lands on, as the lens resolves it; stops at the first miss or scalar. */
export const lensPathFields = (path: string, lens: RuleLens): FieldMapEntry[] =>
  resolveLensPath(lens, path).hops.map((hop) => hop.entry);

export const walkLensPath = (path: string, lens: RuleLens): LensPathWalk => {
  const walk = resolveLensPath(lens, path);
  if (walk.outcome === 'resolved') {
    return walk.jsonSubPath.length ? { outcome: 'beneathJson', index: walk.hops.length - 1 } : { outcome: 'resolved' };
  }
  return walk.outcome === 'pastScalar'
    ? { outcome: 'pastScalar', index: walk.index }
    : { outcome: 'missing', index: walk.index };
};
