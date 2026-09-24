import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createOrganization,
  createSpace,
  createUser,
} from '@template/db/test';
import { backfillPlatformCustomerRefs } from '#/modules/customerRef/services/backfillPlatformCustomerRefs';

describe('backfillPlatformCustomerRefs', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('writes the missing platform refs once, revives tombstones, and leaves present ones alone', async () => {
    const { entity: user } = await createUser();
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const { entity: tombstoned } = await createUser();
    await createCustomerRef({
      customerModel: 'User',
      providerModel: 'platform',
      customerUser: tombstoned,
      deletedAt: new Date(),
    });

    const first = await backfillPlatformCustomerRefs();
    expect(first.User.created).toBeGreaterThanOrEqual(1);
    expect(first.User.revived).toBe(1);
    expect(first.Organization.created).toBeGreaterThanOrEqual(1);
    expect(first.Space.created).toBeGreaterThanOrEqual(1);

    for (const where of [
      { customerUserId: user.id },
      { customerUserId: tombstoned.id },
      { customerOrganizationId: organization.id },
      { customerSpaceId: space.id },
    ]) {
      const refs = await db.customerRef.findMany({
        where: { ...where, providerModel: 'platform', deletedAt: undefined },
      });
      expect(refs).toHaveLength(1);
      expect(refs[0]!.deletedAt).toBeNull();
    }

    const second = await backfillPlatformCustomerRefs();
    expect(second.User.created + second.User.revived).toBe(0);
    expect(second.Organization.created + second.Organization.revived).toBe(0);
    expect(second.Space.created + second.Space.revived).toBe(0);
  });
});
