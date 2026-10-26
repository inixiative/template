import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { registerRulesHook } from '#/hooks/rules/hook';

describe('stored entitlements are entries, on every write (Aron, 2026-10-26)', () => {
  let organization: Organization;

  beforeAll(async () => {
    registerRulesHook();
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const entry = () => ({
    resource: 'db:organization',
    anchor: { resource: 'db:organization', id: organization.id },
    actions: { operate: true },
  });

  it('a member row takes entries or nothing', async () => {
    await createOrganizationUser({ entitlements: [entry()] }, { organization });
    await createOrganizationUser({ entitlements: undefined }, { organization });
  });

  it('a member row refuses a flat map of actions', async () => {
    await expect(
      createOrganizationUser({ entitlements: { operate: true } }, { organization }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('an entry without an anchor is refused', async () => {
    const { anchor: _anchor, ...anchorless } = entry();
    await expect(
      createOrganizationUser({ entitlements: [anchorless] }, { organization }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('an integration refuses a flat map of actions', async () => {
    await expect(
      createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
        role: 'viewer',
        entitlements: { operate: true },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
