import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { createKeyedToken } from '#tests/utils/createKeyedToken';

const operate = [
  {
    resource: 'db:organization',
    anchor: { resource: 'db:organization', id: 'x' },
    actions: { operate: true },
  },
];

describe('writing full clears the role and entitlements beside it', () => {
  let organization: Organization;

  beforeEach(async () => {
    ({ entity: organization } = await createOrganization());
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('an integration created full keeps no role or entitlements', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
      full: true,
      role: 'admin',
      entitlements: operate,
    });
    expect(entity).toMatchObject({ full: true, role: null, entitlements: null });
  });

  it('a token updated to full drops its role and entitlements', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'admin', entitlements: operate },
      { organizationUser: member },
    );
    const updated = await db.token.update({ where: { id: token.id }, data: { full: true } });
    expect(updated).toMatchObject({ full: true, role: null, entitlements: null });
  });
});
