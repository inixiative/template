import { describe, expect, it } from 'bun:test';
import {
  childrenOf,
  childWhereAlong,
  parentAlong,
  parentOf,
} from '@template/db/registries/parentEdges';

describe('parent edges', () => {
  it('an entitlement names its target as its parent, by the materialized id', () => {
    expect(
      parentOf('Entitlement', {
        targetModel: 'SpaceUser',
        targetId: 'su-1',
        targetOrganizationId: 'o-1',
        targetSpaceId: 's-1',
        targetUserId: 'u-1',
      }),
    ).toEqual({ model: 'SpaceUser', id: 'su-1' });
  });

  it('an unregistered model has no parent', () => {
    expect(parentOf('Token', { id: 't-1', organizationId: 'o-1' })).toBeNull();
  });

  it('a record finds its children by the edge that reaches its model', () => {
    expect(childrenOf({ model: 'Token', id: 't-1' })).toEqual([
      { child: 'Entitlement', where: { targetModel: 'Token', targetId: 't-1' } },
    ]);
    expect(childrenOf({ model: 'Organization', id: 'o-1' })).toEqual([]);
  });

  it('a foreign-key edge points at one model by one column', () => {
    const edge = { parent: 'Organization' as const, foreignKey: 'organizationId' };
    expect(parentAlong('OrganizationUser', edge, { organizationId: 'o-1' })).toEqual({
      model: 'Organization',
      id: 'o-1',
    });
    expect(childWhereAlong('OrganizationUser', edge, { model: 'Organization', id: 'o-1' })).toEqual(
      { organizationId: 'o-1' },
    );
    expect(childWhereAlong('OrganizationUser', edge, { model: 'Space', id: 's-1' })).toBeNull();
  });

  it('a composite arm with no materialized id has no single parent id', () => {
    expect(() =>
      parentAlong('Inquiry', { axis: 'targetModel' }, { targetModel: 'SpaceUser' }),
    ).toThrow('materialize its id');
  });
});
