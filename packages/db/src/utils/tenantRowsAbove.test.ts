import { describe, expect, it } from 'bun:test';
import { modelsHeldUnderTenant, tenantRowsAbove } from '@template/db/utils/tenantRowsAbove';

describe('tenantRowsAbove', () => {
  const user = { id: 'user' };
  const organization = { id: 'organization' };
  const space = { id: 'space', organization };

  it('names the space, then the organization, and the user only when neither holds the record', () => {
    expect(tenantRowsAbove({ space, user })).toEqual([
      { model: 'Space', row: space },
      { model: 'Organization', row: organization },
    ]);
    expect(tenantRowsAbove({ organization, user })).toEqual([
      { model: 'Organization', row: organization },
    ]);
    expect(tenantRowsAbove({ user })).toEqual([{ model: 'User', row: user }]);
  });

  it('never reads the user of a record an organization or space holds but did not load', () => {
    expect(tenantRowsAbove({ organizationId: 'organization', user })).toEqual([]);
    expect(tenantRowsAbove({ spaceId: 'space', user })).toEqual([]);
  });
});

describe('modelsHeldUnderTenant', () => {
  it("reads the tenant columns: a member row is the organization's, a flow the user's", () => {
    expect(modelsHeldUnderTenant('User')).toContain('Flow');
    expect(modelsHeldUnderTenant('User')).not.toContain('OrganizationUser');
    expect(modelsHeldUnderTenant('Organization')).toEqual(
      expect.arrayContaining(['Space', 'OrganizationUser', 'SpaceUser', 'Contact']),
    );
    expect(modelsHeldUnderTenant('Organization')).not.toContain('Flow');
    expect(modelsHeldUnderTenant('Space')).toContain('SpaceUser');
    expect(modelsHeldUnderTenant('Space')).not.toContain('Space');
  });
});
