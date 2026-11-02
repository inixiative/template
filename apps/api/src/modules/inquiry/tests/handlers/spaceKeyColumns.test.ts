import { describe, expect, it } from 'bun:test';
import { spaceKeyColumns } from '#/modules/inquiry/handlers/transferSpace/spaceKeyColumns';

describe('spaceKeyColumns', () => {
  it('pairs each space column with the organization column its composite key carries', () => {
    expect(spaceKeyColumns('Token')).toEqual([
      { spaceField: 'spaceId', organizationField: 'organizationId' },
    ]);
  });

  it('finds prefixed polymorphic columns', () => {
    expect(spaceKeyColumns('Inquiry')).toEqual([
      { spaceField: 'sourceSpaceId', organizationField: 'sourceOrganizationId' },
      { spaceField: 'targetSpaceId', organizationField: 'targetOrganizationId' },
    ]);
  });

  it('skips space references that carry no organization, which the transfer leaves as they are', () => {
    expect(spaceKeyColumns('CustomerRef')).toEqual([]);
  });
});
