import { describe, expect, it } from 'bun:test';
import { type EntitlementEntry, placeEntitlement } from '@inixiative/permissions';
import { schemaMap } from '@template/db/schemaMap';

const anchor = { id: 'a1', organizationId: 'o1' };

const kinds = (resource: string, anchorResource: string, path: string, field = 'ownerModel') =>
  placeEntitlement(
    schemaMap,
    {
      resource: `db:${resource}`,
      anchor: { resource: `db:${anchorResource}`, id: 'a1', path },
      actions: { read: true },
    } as EntitlementEntry,
    anchor,
  )?.map((record) => record[field]);

describe('the real schema map: a path admits every kind that carries its keys (R81)', () => {
  it('an integration via organization: every kind under the organization', () => {
    expect(kinds('integration', 'organization', 'organization')).toEqual([
      'OrganizationUser',
      'Organization',
      'Space',
      'SpaceUser',
    ]);
  });

  it('via space.organization: a space and its members', () => {
    expect(kinds('integration', 'organization', 'space.organization')).toEqual([
      'Space',
      'SpaceUser',
    ]);
  });

  it("via organizationUser.organization: a member's, including as a space member", () => {
    expect(kinds('integration', 'organization', 'organizationUser.organization')).toEqual([
      'OrganizationUser',
      'SpaceUser',
    ]);
  });

  it("via user: the user's own and the user's members' integrations", () => {
    expect(kinds('integration', 'user', 'user')).toEqual(['User', 'OrganizationUser', 'SpaceUser']);
  });

  it('an inquiry names a side: what the organization or its members received', () => {
    expect(kinds('inquiry', 'organization', 'targetOrganization', 'targetModel')).toEqual([
      'OrganizationUser',
      'Organization',
      'SpaceUser',
    ]);
    expect(kinds('inquiry', 'space', 'sourceSpace', 'sourceModel')).toEqual(['Space', 'SpaceUser']);
  });

  it('a token owned by an integration: a kind at each step', () => {
    const placed = placeEntitlement(
      schemaMap,
      {
        resource: 'db:token',
        anchor: { resource: 'db:organization', id: 'a1', path: 'integration.space.organization' },
        actions: { read: true },
      } as EntitlementEntry,
      anchor,
    );
    expect(
      placed?.map((token) => [
        token.ownerModel,
        (token.integration as { ownerModel: string }).ownerModel,
      ]),
    ).toEqual([
      ['Integration', 'Space'],
      ['Integration', 'SpaceUser'],
    ]);
  });

  it('a plain foreign key names no kind', () => {
    expect(kinds('webhookSubscription', 'integration', 'integration')).toEqual([undefined]);
  });

  it('a path that does not end at the anchor model places nothing', () => {
    expect(kinds('integration', 'space', 'organization')).toBeUndefined();
  });
});
