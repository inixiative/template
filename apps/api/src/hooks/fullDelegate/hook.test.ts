import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { registerFullDelegateHook } from '#/hooks/fullDelegate/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
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

  beforeAll(async () => {
    registerFullDelegateHook();
    registerRulesHook();
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
    for (const name of [
      'fullDelegate',
      'fullDelegate:upsert',
      'rules:create',
      'rules:upsert',
      'rules:update',
      'rules:updateManyAndReturn',
    ])
      unregisterDbHook(name);
    await cleanupTouchedTables(db);
  });

  it('an integration created full keeps no role or entitlements', async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: seat.organizationId,
      userId: seat.userId,
      full: true,
      role: 'admin',
      entitlements: operate,
    });
    expect(entity).toMatchObject({ full: true, role: null, entitlements: null });
  });

  it('a token updated to full drops its role and entitlements', async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'admin', entitlements: operate },
      { organizationUser: seat },
    );
    const updated = await db.token.update({ where: { id: token.id }, data: { full: true } });
    expect(updated).toMatchObject({ full: true, role: null, entitlements: null });
  });
});
