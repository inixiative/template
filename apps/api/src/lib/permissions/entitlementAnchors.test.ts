import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { entry } from '#tests/utils/entitlementEntry';
import { grantEntitlements } from '#tests/utils/entitlements';

describe("an entitlement's anchor is read when the row is written, even past the grant check", () => {
  let organization: Organization;
  let holder: OrganizationUser;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: holder } = await createOrganizationUser({}, { organization }));
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    app = createTestApp({
      mockUser: superadmin,
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const onHolder = () => ({ model: 'OrganizationUser' as const, id: holder.id });

  it('an anchor that does not exist is refused with a 422, not a 500', async () => {
    const response = await grantEntitlements(app, onHolder(), [
      entry('db:organizationUser', ['db:organizationUser', 'no-such-member'], ['read']),
    ]);
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toBe(
      'OrganizationUser no-such-member not found',
    );
  });

  it('a tombstoned anchor is refused by the grant check, superadmin included', async () => {
    const { entity: anchor } = await createOrganizationUser({}, { organization });
    await db.organizationUser.update({ where: { id: anchor.id }, data: { deletedAt: new Date() } });

    const response = await grantEntitlements(app, onHolder(), [
      entry('db:organizationUser', ['db:organizationUser', anchor.id], ['read']),
    ]);
    expect(response.status).toBe(422);
  });
});
