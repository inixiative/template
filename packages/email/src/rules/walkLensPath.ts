/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';

export type LensPathWalk =
  | { outcome: 'resolved' }
  | { outcome: 'missing'; index: number }
  | { outcome: 'beneathJson'; index: number }
  | { outcome: 'pastScalar'; index: number };

const baseOf = (lens: Lens | LensNarrowing): Lens => ('parent' in lens ? rootLens(lens) : lens);

export const walkLensPath = (path: string, lens: Lens | LensNarrowing): LensPathWalk => {
  const base = baseOf(lens);
  const segments = path.split('.');
  let mapName = base.mapName;
  let model = base.model;

  for (let i = 0; i < segments.length; i++) {
    const field = base.maps[mapName]?.models[model]?.fields[segments[i] ?? ''];
    if (!field) return { outcome: 'missing', index: i };

    if (field.kind === 'scalar' && field.type === 'Json') {
      return i < segments.length - 1 ? { outcome: 'beneathJson', index: i } : { outcome: 'resolved' };
    }

    if ((field.kind === 'object' || field.kind === 'bridge') && field.type) {
      if (field.type.includes(':')) {
        const [bridgeMap, bridgeModel] = field.type.split(':');
        mapName = bridgeMap ?? mapName;
        model = bridgeModel ?? field.type;
      } else {
        model = field.type;
      }
      continue;
    }

    if (i < segments.length - 1) return { outcome: 'pastScalar', index: i };
  }

  return { outcome: 'resolved' };
};
