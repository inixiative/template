import { describe, expect, it } from 'bun:test';
import {
  bindLens,
  getLensRoot,
  type LensNarrowing,
  Operator,
  validateNarrowing,
} from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { lensFor } from '@template/db/lens';
import { senderOrganizationLens } from '#/lib/email/lenses/senderOrganizationLens';
import { senderOrganizationUserLens } from '#/lib/email/lenses/senderOrganizationUserLens';
import { senderSpaceLens } from '#/lib/email/lenses/senderSpaceLens';
import { senderSpaceUserLens } from '#/lib/email/lenses/senderSpaceUserLens';
import { senderUserLens } from '#/lib/email/lenses/senderUserLens';
import { lensOutput } from '#tests/utils/lensOutput';

const deletedPerCallLens = (model: ModelName, key: Record<string, string>): LensNarrowing => {
  const lens = lensFor(model);
  const base = getLensRoot(lens);
  const fields = base.maps[base.mapName]?.models[base.model]?.fields ?? {};
  return {
    parent: lens,
    root: {
      where: {
        all: Object.entries(key).map(([field, value]) => ({
          field,
          operator: Operator.equals,
          value,
        })),
      },
      picks: Object.entries(fields)
        .filter(([, field]) => field.kind !== 'object' && field.kind !== 'bridge')
        .map(([name]) => name),
    },
  };
};

const SENDER_ROWS: [LensNarrowing, Record<string, string>, LensNarrowing][] = [
  [senderUserLens, { userId: 'u1' }, deletedPerCallLens('User', { id: 'u1' })],
  [
    senderOrganizationLens,
    { organizationId: 'o1' },
    deletedPerCallLens('Organization', { id: 'o1' }),
  ],
  [senderSpaceLens, { spaceId: 's1' }, deletedPerCallLens('Space', { id: 's1' })],
  [
    senderOrganizationUserLens,
    { userId: 'u1', organizationId: 'o1' },
    deletedPerCallLens('OrganizationUser', { userId: 'u1', organizationId: 'o1' }),
  ],
  [
    senderSpaceUserLens,
    { userId: 'u1', spaceId: 's1' },
    deletedPerCallLens('SpaceUser', { userId: 'u1', spaceId: 's1' }),
  ],
];

describe('the sender row lenses', () => {
  it('each is a valid static narrowing that names its row only by bind tokens', () => {
    for (const [lens] of SENDER_ROWS) {
      expect(validateNarrowing(lens).errors).toEqual([]);
      expect(JSON.stringify(lens.root)).not.toContain('"value"');
    }
  });

  it('bound, each projects, sources and selects as the lens resolveSender assembled per call', () => {
    for (const [lens, bindings, perCall] of SENDER_ROWS)
      expect(lensOutput(bindLens(lens, bindings))).toEqual(lensOutput(perCall));
  });
});
