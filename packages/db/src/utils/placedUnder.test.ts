import { describe, expect, it } from 'bun:test';
import { placedUnder } from '@template/db/utils/ownerColumns';

describe('placedUnder: the condition a record meets when it sits under an owner', () => {
  it('a polymorphic owner: the discriminator and the owner relation', () => {
    expect(placedUnder('integration', 'organization', 'o1')).toEqual({
      all: [
        { field: 'ownerModel', operator: 'equals', value: 'Organization' },
        { field: 'organization.id', operator: 'equals', value: 'o1' },
      ],
    });
  });

  it('a composite key (a space, a membership): read through the hydrated relation', () => {
    expect(placedUnder('integration', 'space', 's1')).toEqual({
      all: [
        { field: 'ownerModel', operator: 'equals', value: 'Space' },
        { field: 'space.id', operator: 'equals', value: 's1' },
      ],
    });
    expect(placedUnder('integration', 'organizationUser', 'ou1')).toEqual({
      all: [
        { field: 'ownerModel', operator: 'equals', value: 'OrganizationUser' },
        { field: 'organizationUser.id', operator: 'equals', value: 'ou1' },
      ],
    });
  });

  it('a plain foreign key: the relation alone', () => {
    expect(placedUnder('spaceUser', 'organization', 'o1')).toEqual({
      field: 'organization.id',
      operator: 'equals',
      value: 'o1',
    });
  });

  it('off the tree: null', () => {
    expect(placedUnder('organization', 'space', 's1')).toBeNull();
  });
});
