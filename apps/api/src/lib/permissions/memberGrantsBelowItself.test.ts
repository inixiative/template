import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, type HydratedRecord, hydrate } from '@template/db';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Role,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import {
  createPermissions,
  installPermissions,
  memberSelfGrant,
  permissionsOfUser,
  toEntitlementInput,
} from '@template/permissions';
import type { EntitlementFields } from '@template/permissions/entitlementRows';
import { canGrantEntitlement, placeEntitlement, schemaMap } from '@template/permissions/rebac';
import { narrowOwnerPermissionsToDelegate } from '#/lib/permissions/ownerPermissions';
import { integrationRouter } from '#/modules/integration';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { entitlementInputFor } from '#tests/utils/entitlementInputFor';

const { call } = createTokenProbeApp((hono) =>
  hono.route('/api/v1/integration', integrationRouter),
);

const integrationOf = async (member: OrganizationUser) =>
  (
    await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
      role: null,
    })
  ).entity;

const manageIt = (integration: Integration) =>
  entitlementInputFor('db:integration', ['db:integration', integration.id], ['manage']);

describe("a member's operate on itself grants below it: its own integrations (Aron, 2026-11-14)", () => {
  let organization: Organization;
  let member: OrganizationUser;
  let own: Integration;
  let holder: Integration;

  beforeEach(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: member } = await createOrganizationUser({ role: 'member' }, { organization }));
    own = await integrationOf(member);
    holder = await integrationOf(member);
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const tokenOnMember = async (delegation: { role: Role | null; full?: boolean }) =>
    (
      await createKeyedToken(
        { ownerModel: 'OrganizationUser', ...delegation },
        { organizationUser: member },
      )
    ).rawKey;

  const grant = (key: string, to: Integration, granted: ReturnType<typeof entitlementInputFor>) =>
    call(key, 'POST', `/api/v1/integration/${to.id}/entitlements`, [granted]);

  it('a full token on the member gives one of its integrations manage on another', async () => {
    expect(
      (await grant(await tokenOnMember({ role: null, full: true }), holder, manageIt(own))).status,
    ).toBe(201);
  });

  it('a token capped at the member role is not the member: refused', async () => {
    expect(
      (await grant(await tokenOnMember({ role: 'member' }), holder, manageIt(own))).status,
    ).toBe(403);
  });

  it("another member's integration stays out of reach", async () => {
    const { entity: other } = await createOrganizationUser({ role: 'member' }, { organization });
    const theirs = await integrationOf(other);
    const response = await grant(
      await tokenOnMember({ role: null, full: true }),
      holder,
      manageIt(theirs),
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe(
      `A delegate holds your permissions or less: you cannot give manage on db:integration at db:integration ${theirs.id}`,
    );
  });

  describe('only an unconditional, unlensed self-grant grants below (Aron, 2026-11-14)', () => {
    const grants = async (row: EntitlementFields) => {
      const permix = createPermissions();
      await installPermissions(
        permix,
        narrowOwnerPermissionsToDelegate(
          { full: true },
          permissionsOfUser(null, [{ ...member, targetEntitlements: [row] }], []),
        ),
      );
      const granted = {
        resource: 'db:integration',
        anchor: { resource: 'db:integration', id: own.id },
        actions: { manage: true },
      };
      const anchor = await hydrate('integration', own as unknown as HydratedRecord);
      const placed = placeEntitlement(schemaMap, granted, anchor) ?? [];
      return (
        placed.length > 0 &&
        placed.every((record) => canGrantEntitlement(permix, granted, record as HydratedRecord))
      );
    };

    const stored = (): EntitlementFields => ({
      ...toEntitlementInput(memberSelfGrant('db:organizationUser', member)),
      where: null,
      lens: null,
    });

    it('as stored, it grants below', async () => {
      expect(await grants(stored())).toBe(true);
    });

    it('with a lens, it does not', async () => {
      expect(
        await grants({
          ...stored(),
          lens: { where: { field: 'name', operator: 'equals', value: 'x' } },
        }),
      ).toBe(false);
    });

    it('with a where, it does not', async () => {
      expect(
        await grants({ ...stored(), where: { field: 'id', operator: 'equals', value: member.id } }),
      ).toBe(false);
    });
  });
});
