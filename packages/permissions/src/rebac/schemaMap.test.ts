import { describe, expect, it } from 'bun:test';
import { type EntitlementEntry, placeEntitlement as place } from '@inixiative/permissions';
import { schemaMap } from '@template/permissions/rebac/check';

const placeEntitlement = (entry: EntitlementEntry, anchor: Record<string, unknown>) =>
  place(schemaMap, entry, anchor);

const organization = { id: 'o1' };
const space = { id: 's1', organizationId: 'o1' };
const integration = { id: 'i1' };

const entry = (resource: string, anchor: string, id: string, path: string): EntitlementEntry => ({
  resource: `db:${resource}`,
  anchor: { resource: `db:${anchor}`, id, path },
  actions: { read: true },
});

describe('the real schema map: each polymorphic step of a path names one kind', () => {
  it("an integration via organization is the organization's own", () => {
    expect(
      placeEntitlement(entry('integration', 'organization', 'o1', 'organization'), organization),
    ).toEqual({
      ownerModel: 'Organization',
      organizationId: 'o1',
      organization,
    });
  });

  it("an integration via space.organization is a space's, under a space of the organization", () => {
    expect(
      placeEntitlement(
        entry('integration', 'organization', 'o1', 'space.organization'),
        organization,
      ),
    ).toEqual({
      ownerModel: 'Space',
      organizationId: 'o1',
      space: { organizationId: 'o1', organization },
    });
  });

  it("an integration via organizationUser.organization is a member's", () => {
    expect(
      placeEntitlement(
        entry('integration', 'organization', 'o1', 'organizationUser.organization'),
        organization,
      ),
    ).toMatchObject({ ownerModel: 'OrganizationUser', organizationId: 'o1' });
  });

  it('an inquiry names a side and a kind', () => {
    expect(
      placeEntitlement(entry('inquiry', 'organization', 'o1', 'targetOrganization'), organization),
    ).toEqual({
      targetModel: 'Organization',
      targetOrganizationId: 'o1',
      targetOrganization: organization,
    });
    expect(placeEntitlement(entry('inquiry', 'space', 's1', 'sourceSpace'), space)).toEqual({
      sourceModel: 'Space',
      sourceSpaceId: 's1',
      sourceSpace: space,
    });
  });

  it("an email template's space, by spaceId alone, is ownerModel Space", () => {
    expect(placeEntitlement(entry('emailTemplate', 'space', 's1', 'space'), space)).toMatchObject({
      ownerModel: 'Space',
      spaceId: 's1',
    });
  });

  it('a token owned by an integration owned by a space: a kind at each step', () => {
    expect(
      placeEntitlement(
        entry('token', 'organization', 'o1', 'integration.space.organization'),
        organization,
      ),
    ).toMatchObject({ ownerModel: 'Integration', integration: { ownerModel: 'Space' } });
  });

  it('a plain foreign key names no kind', () => {
    const placed = placeEntitlement(
      entry('webhookSubscription', 'integration', 'i1', 'integration'),
      integration,
    );
    expect(placed).toEqual({ integrationId: 'i1', integration });
  });

  it('a path that does not end at the anchor model is null', () => {
    expect(placeEntitlement(entry('integration', 'space', 's1', 'organization'), space)).toBeNull();
  });
});
