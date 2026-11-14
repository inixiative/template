import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import { ProviderModel, SegmentType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createSegment,
  createSpace,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { emitAppEvent } from '#/appEvents/emit';
import { registerPlatformCustomerRefHook } from '#/hooks/platformCustomerRef/hook';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { provisionPlatformCustomerRef } from '#/modules/customerRef/services/provisionPlatformCustomerRef';
import { memberIds } from '#/modules/segment/tests/fixtures';

const platformRefsOf = (where: Record<string, string>) =>
  db.customerRef.findMany({ where: { ...where, providerModel: 'platform', deletedAt: undefined } });

describe('platformCustomerRef hook', () => {
  beforeAll(() => {
    registerPlatformCustomerRefHook();
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('every new user, organization and space gets exactly one platform customer ref', async () => {
    const { entity: user } = await createUser();
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });

    expect(await platformRefsOf({ customerUserId: user.id })).toHaveLength(1);
    expect(await platformRefsOf({ customerOrganizationId: organization.id })).toHaveLength(1);
    expect(await platformRefsOf({ customerSpaceId: space.id })).toHaveLength(1);
    expect((await platformRefsOf({ customerUserId: user.id }))[0]!.customerModel).toBe('User');
  });

  it('provisioning again is a no-op, and a tombstoned ref is revived rather than duplicated', async () => {
    const { entity: user } = await createUser();
    const [ref] = await platformRefsOf({ customerUserId: user.id });

    expect((await provisionPlatformCustomerRef('User', user.id)).outcome).toBe('present');
    expect(await platformRefsOf({ customerUserId: user.id })).toHaveLength(1);

    await db.customerRef.update({ where: { id: ref!.id }, data: { deletedAt: new Date() } });
    const revived = await provisionPlatformCustomerRef('User', user.id);
    expect(revived.outcome).toBe('revived');
    expect(revived.customerRef.id).toBe(ref!.id);
    const refs = await platformRefsOf({ customerUserId: user.id });
    expect(refs).toHaveLength(1);
    expect(refs[0]!.deletedAt).toBeNull();
  });

  it('a newcomer joins the platform’s dynamic segments as they are created', async () => {
    const domain = `@newcomer-${getNextSeq()}.test`;
    const { entity: segment } = await createSegment({
      ownerModel: ProviderModel.platform,
      type: SegmentType.dynamic,
      conditions: { field: 'customerUser.email', operator: Operator.endsWith, value: domain },
    });
    await emitAppEvent('segment.created', { segment });
    expect(await memberIds(segment.id)).toEqual([]);

    const { entity: newcomer } = await createUser({ email: `n-${getNextSeq()}${domain}` });
    const [ref] = await platformRefsOf({ customerUserId: newcomer.id });
    expect(await memberIds(segment.id)).toEqual([ref!.id]);
  });
});
