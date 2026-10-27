import { describe, expect, it } from 'bun:test';
import { directOwner } from '@template/db/utils/directOwner';

describe('directOwner: the owner a record sits directly under on the tenancy tree', () => {
  it('an owner-polymorphic record: the owner its ownerModel names', () => {
    expect(
      directOwner('integration', { ownerModel: 'Space', spaceId: 's1', organizationId: 'o1' }),
    ).toEqual({ accessor: 'space', id: 's1' });
    expect(directOwner('token', { ownerModel: 'Organization', organizationId: 'o1' })).toEqual({
      accessor: 'organization',
      id: 'o1',
    });
  });

  it('a member-owned record: the membership row it hydrated', () => {
    expect(
      directOwner('integration', {
        ownerModel: 'OrganizationUser',
        organizationId: 'o1',
        userId: 'u1',
        organizationUser: { id: 'ou1' },
      }),
    ).toEqual({ accessor: 'organizationUser', id: 'ou1' });
  });

  it('a membership or a space: its nearest tenant', () => {
    expect(directOwner('spaceUser', { spaceId: 's1', organizationId: 'o1', userId: 'u1' })).toEqual(
      { accessor: 'space', id: 's1' },
    );
    expect(directOwner('organizationUser', { organizationId: 'o1', userId: 'u1' })).toEqual({
      accessor: 'organization',
      id: 'o1',
    });
    expect(directOwner('space', { organizationId: 'o1' })).toEqual({
      accessor: 'organization',
      id: 'o1',
    });
  });

  it('a record with no owner set, or a root, has none', () => {
    expect(directOwner('integration', { ownerModel: 'Space' })).toBeNull();
    expect(directOwner('organization', { id: 'o1' })).toBeNull();
  });
});
