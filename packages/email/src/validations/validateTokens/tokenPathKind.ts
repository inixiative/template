/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';
import type { TokenPathKind } from '@template/email/validations/validateTokens/types';

const baseOf = (lens: Lens | LensNarrowing): Lens => ('parent' in lens ? rootLens(lens) : lens);

export const tokenPathKind = (path: string, lens: Lens | LensNarrowing, viaEach: boolean): TokenPathKind => {
  const base = baseOf(lens);
  const segments = path.split('.');
  let mapName = base.mapName;
  let model = base.model;
  let optionalDepth = 0;

  for (let i = 0; i < segments.length; i++) {
    const field = base.maps[mapName]?.models[model]?.fields[segments[i] ?? ''];
    if (!field) return { kind: 'missing', index: i };
    const last = i === segments.length - 1;

    if (field.kind === 'scalar' && field.type === 'Json') {
      return { kind: 'ok', optionalDepth: last && field.isRequired !== false ? 0 : segments.length, scalarList: false };
    }

    if ((field.kind === 'object' || field.kind === 'bridge') && field.type) {
      if (last) return { kind: 'object' };
      if (field.isList && !viaEach) return { kind: 'listWithoutEach', index: i };
      if (field.isRequired === false && !field.isList) optionalDepth = i + 1;
      if (field.type.includes(':')) {
        const [bridgeMap, bridgeModel] = field.type.split(':');
        mapName = bridgeMap ?? mapName;
        model = bridgeModel ?? field.type;
      } else {
        model = field.type;
      }
      continue;
    }

    if (!last) return { kind: 'pastScalar', index: i };
    if (field.isRequired === false) optionalDepth = i + 1;
    return { kind: 'ok', optionalDepth, scalarList: field.isList === true };
  }

  return { kind: 'ok', optionalDepth, scalarList: false };
};
