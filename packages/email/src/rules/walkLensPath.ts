/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { lensFieldResolver } from '@template/email/rules/lensFieldResolver';

export type LensPathWalk =
  | { outcome: 'resolved' }
  | { outcome: 'missing'; index: number }
  | { outcome: 'beneathJson'; index: number }
  | { outcome: 'pastScalar'; index: number };

export const walkLensPath = (path: string, lens: Lens | LensNarrowing): LensPathWalk => {
  const { start, resolve } = lensFieldResolver(lens);
  const segments = path.split('.');
  let cursor = start;

  for (let i = 0; i < segments.length; i++) {
    const hop = resolve(cursor, segments[i] ?? '');
    if (!hop) return { outcome: 'missing', index: i };
    const { field } = hop;

    if (field.kind === 'scalar' && field.type === 'Json') {
      return i < segments.length - 1 ? { outcome: 'beneathJson', index: i } : { outcome: 'resolved' };
    }

    if (field.kind === 'object' || field.kind === 'bridge') {
      cursor = hop.next;
      continue;
    }

    if (i < segments.length - 1) return { outcome: 'pastScalar', index: i };
  }

  return { outcome: 'resolved' };
};
