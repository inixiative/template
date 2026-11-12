import { describe, expect, it } from 'bun:test';
import { childRelations } from '#/hooks/softDeleteCascade/childRelations';

describe('childRelations', () => {
  it('a polymorphic arm reaches only the rows of its own arm, though a deeper arm shares its keys', () => {
    const entitlementArms = childRelations('OrganizationUser')
      .filter(({ model }) => model === 'Entitlement')
      .map(({ fromFields, arm }) => ({ fromFields, arm }));
    expect(entitlementArms).toEqual([
      {
        fromFields: ['targetOrganizationId', 'targetUserId'],
        arm: { targetModel: 'OrganizationUser' },
      },
    ]);
  });

  it('a plain relation carries no arm', () => {
    const spaceUsers = childRelations('OrganizationUser').find(
      ({ model }) => model === 'SpaceUser',
    );
    expect(spaceUsers?.arm).toEqual({});
  });
});
