/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { type EmailLens, OPAQUE_SLOT, slotOf, splitRoot } from '@template/email/rules/emailLens';
import { lensFieldResolver } from '@template/email/rules/lensFieldResolver';
import type { TokenPathKind } from '@template/email/validations/validateTokens/types';

export const tokenPathKind = (path: string, lens: Lens | LensNarrowing, viaEach: boolean): TokenPathKind => {
  const { start, resolve } = lensFieldResolver(lens);
  const segments = path.split('.');
  let cursor = start;
  let optionalDepth = 0;

  for (let i = 0; i < segments.length; i++) {
    const hop = resolve(cursor, segments[i] ?? '');
    if (!hop) return { kind: 'missing', index: i };
    const { field } = hop;
    const last = i === segments.length - 1;

    if (field.kind === 'scalar' && field.type === 'Json') {
      return { kind: 'ok', optionalDepth: last && field.isRequired !== false ? 0 : segments.length, scalarList: false };
    }

    if ((field.kind === 'object' || field.kind === 'bridge') && field.type) {
      if (last) return { kind: 'object' };
      if (field.isList && !viaEach) return { kind: 'listWithoutEach', index: i };
      if (field.isRequired === false && !field.isList) optionalDepth = i + 1;
      cursor = hop.next;
      continue;
    }

    if (!last) return { kind: 'pastScalar', index: i };
    if (field.isRequired === false) optionalDepth = i + 1;
    return { kind: 'ok', optionalDepth, scalarList: field.isList === true };
  }

  return { kind: 'ok', optionalDepth, scalarList: false };
};

export const emailTokenPathKind = (path: string, lens: EmailLens, viaEach: boolean): TokenPathKind => {
  const { root, rest } = splitRoot(path);
  const slot = slotOf(lens, root);
  if (!slot) return { kind: 'missing', index: 0 };
  if (slot === OPAQUE_SLOT) return { kind: 'ok', optionalDepth: rest ? path.split('.').length : 0, scalarList: false };
  if (!rest) return { kind: 'object' };
  const kind = tokenPathKind(rest, slot, viaEach);
  switch (kind.kind) {
    case 'ok':
      return { ...kind, optionalDepth: kind.optionalDepth ? kind.optionalDepth + 1 : 0 };
    case 'object':
      return kind;
    default:
      return { ...kind, index: kind.index + 1 };
  }
};
