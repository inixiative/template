import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, type EntitlementInput } from '@template/db';
import type { Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  storeEntitlements,
} from '@template/db/test';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { heldEntitlements } from '#tests/utils/entitlements';

const operate = (organizationId: string): EntitlementInput[] => [
  {
    resource: 'Organization',
    actions: ['operate'],
    sourceModel: 'Organization',
    sourceId: organizationId,
  },
];

describe('writing full clears the role and tombstones the entitlement rows beside it', () => {
  let organization: Organization;

  beforeEach(async () => {
    ({ entity: organization } = await createOrganization());
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('an integration created full keeps no role', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
      full: true,
      role: 'admin',
    });
    expect(entity).toMatchObject({ full: true, role: null });
  });

  it('a token updated to full drops its role and entitlements', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'admin', entitlements: operate(organization.id) },
      { organizationUser: member },
    );
    const updated = await db.token.update({ where: { id: token.id }, data: { full: true } });
    expect(updated).toMatchObject({ full: true, role: null });
    expect(await heldEntitlements({ model: 'Token', id: token.id })).toEqual([]);
    const tombstoned = await db.withDeleted(() =>
      db.entitlement.findMany({ where: { targetModel: 'Token', targetId: token.id } }),
    );
    expect(tombstoned.map((row) => row.deletedAt != null)).toEqual([true]);
  });

  it('an integration revived as full brings back none of the entitlements removed with it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
      role: 'viewer',
    });
    await storeEntitlements({ model: 'Integration', row: integration }, operate(organization.id));
    await db.integration.update({ where: { id: integration.id }, data: { deletedAt: new Date() } });

    await db.withDeleted(() =>
      db.integration.update({
        where: { id: integration.id },
        data: { deletedAt: null, full: true },
      }),
    );

    expect(await heldEntitlements({ model: 'Integration', id: integration.id })).toEqual([]);
  });
});
