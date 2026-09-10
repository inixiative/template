import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type {
  CustomerRef,
  Organization,
  OrganizationUser,
  Segment,
  SegmentMember,
  Space,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createOrganizationUser,
  createSpace,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { registerSegmentReconcileHook } from '#/hooks/segmentReconcile/hook';
import { meRouter } from '#/modules/me';
import { segmentRouter } from '#/modules/segment';
import { spaceRouter } from '#/modules/space';
import { userRouter } from '#/modules/user';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

type Membership = SegmentMember & { segment: Segment };

describe('segment routes', () => {
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];
  let customerFetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let owner: User;
  let orgUser: OrganizationUser;
  let org: Organization;
  let space: Space;
  let customer: User;
  let customerRef: CustomerRef;
  let outsider: User;
  let outsiderRef: CustomerRef;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();
    registerSegmentReconcileHook();

    const { entity: ou, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = ou;
    owner = context.user;
    org = context.organization;
    space = (await createSpace({}, { organization: org })).entity;

    customer = (await createUser({ email: `customer-${getNextSeq()}@acme.test` })).entity;
    outsider = (await createUser({ email: `outsider-${getNextSeq()}@example.test` })).entity;
    customerRef = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: customer,
        providerSpace: space,
      })
    ).entity;
    outsiderRef = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: outsider,
        providerSpace: space,
      })
    ).entity;

    const mount: MountFn[] = [
      (app) => {
        app.route('/api/v1/space', spaceRouter);
        app.route('/api/v1/segment', segmentRouter);
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/user', userRouter);
      },
    ];
    const spaceUser = await db.spaceUser.create({
      data: { role: 'admin', organizationId: org.id, spaceId: space.id, userId: owner.id },
    });
    const ownerHarness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser],
      mount,
    });
    ownerFetch = ownerHarness.fetch;
    testDb = ownerHarness.db;
    customerFetch = createTestApp({ mockUser: customer, mount }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
    clearHookRegistry();
  });

  let segment: Segment;

  it('the space owner creates a dynamic segment and it is reconciled on commit', async () => {
    const response = await ownerFetch(
      post(`/api/v1/space/${space.id}/segments`, {
        name: `acme-${getNextSeq()}`,
        type: 'dynamic',
        conditions: acmeRule,
      }),
    );
    expect(response.status).toBe(201);
    segment = (await json<Segment>(response)).data;
    expect(segment.ownerModel).toBe('Space');
    expect(segment.spaceId).toBe(space.id);

    const members = await ownerFetch(get(`/api/v1/segment/${segment.id}/segmentMembers`));
    const { data } = await json<(SegmentMember & { customerRef: CustomerRef })[]>(members);
    expect(data.map((member) => member.customerRefId)).toEqual([customerRef.id]);
    expect(data[0]!.customerRef.customerUser).toBeTruthy();
  });

  it('the space lists the segments it owns', async () => {
    const response = await ownerFetch(get(`/api/v1/space/${space.id}/segments`));
    const { data } = await json<Segment[]>(response);
    expect(response.status).toBe(200);
    expect(data.map((each) => each.id)).toContain(segment.id);
  });

  it('the customer sees the segment they belong to and cannot read the owner view', async () => {
    const mine = await customerFetch(get('/api/v1/me/segmentMemberships'));
    const { data } = await json<Membership[]>(mine);
    expect(mine.status).toBe(200);
    expect(data.map((member) => member.segment.id)).toEqual([segment.id]);
    expect(data[0]!.segment).not.toHaveProperty('conditions');
    expect(data[0]!.segment).not.toHaveProperty('reconcilePausedDetail');

    const denied = await customerFetch(get(`/api/v1/segment/${segment.id}`));
    expect(denied.status).toBe(403);
  });

  it('the user context reads a user’s own segments and memberships and refuses everyone else', async () => {
    const memberships = await customerFetch(get(`/api/v1/user/${customer.id}/segmentMemberships`));
    expect(memberships.status).toBe(200);
    const { data } = await json<Membership[]>(memberships);
    expect(data.map((member) => member.segment.id)).toEqual([segment.id]);

    const owned = await customerFetch(get(`/api/v1/user/${customer.id}/segments`));
    expect(owned.status).toBe(200);
    expect((await json<Segment[]>(owned)).data).toEqual([]);

    const denied = await ownerFetch(get(`/api/v1/user/${customer.id}/segmentMemberships`));
    expect(denied.status).toBe(403);
  });

  it('the owner hand-picks an audience as a static segment over ids, scoped to their own customers', async () => {
    const elsewhere = (await createSpace({}, { organization: org })).entity;
    const foreign = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: outsider,
        providerSpace: elsewhere,
      })
    ).entity;
    const response = await ownerFetch(
      post(`/api/v1/space/${space.id}/segments`, {
        name: `picked-${getNextSeq()}`,
        type: 'static',
        conditions: { field: 'id', operator: Operator.in, value: [outsiderRef.id, foreign.id] },
      }),
    );
    expect(response.status).toBe(201);
    const picked = (await json<Segment>(response)).data;

    const members = await ownerFetch(get(`/api/v1/segment/${picked.id}/segmentMembers`));
    const { data } = await json<SegmentMember[]>(members);
    expect(data.map((member) => member.customerRefId)).toEqual([outsiderRef.id]);
  });

  it('rejects conditions outside the lens with a 422', async () => {
    const response = await ownerFetch(
      post(`/api/v1/space/${space.id}/segments`, {
        name: `bad-${getNextSeq()}`,
        type: 'dynamic',
        conditions: { field: 'customerUser.platformRole', operator: Operator.equals, value: 'superadmin' },
      }),
    );
    expect(response.status).toBe(422);
  });
});
