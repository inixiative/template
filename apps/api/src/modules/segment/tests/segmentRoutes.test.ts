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
  createSegment,
  createSpace,
  createSpaceUser,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { segmentRouter } from '#/modules/segment';
import { spaceRouter } from '#/modules/space';
import { userRouter } from '#/modules/user';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, get, json, post } from '#tests/utils/request';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

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
        app.route('/api/v1/organization', organizationRouter);
        app.route('/api/v1/user', userRouter);
      },
    ];
    const { entity: spaceUser } = await createSpaceUser({ role: 'admin' }, { ...context, space });
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
    const { data } = await json<(Segment & { ruleIssues: unknown[] })[]>(response);
    expect(response.status).toBe(200);
    expect(data.map((each) => each.id)).toContain(segment.id);
    expect(data.find((each) => each.id === segment.id)!.ruleIssues).toEqual([]);
  });

  it('the customer sees the segment they belong to and cannot read the owner view', async () => {
    const mine = await customerFetch(get('/api/v1/me/segmentMemberships'));
    const { data } = await json<Membership[]>(mine);
    expect(mine.status).toBe(200);
    expect(data.map((member) => member.segment.id)).toEqual([segment.id]);
    expect(data[0]!.segment).not.toHaveProperty('conditions');
    expect(data[0]!.segment).not.toHaveProperty('ruleIssues');

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

  it('reach counts the customers a candidate rule would match, without saving anything', async () => {
    const before = await db.segment.count();
    const response = await ownerFetch(post(`/api/v1/space/${space.id}/segments/reach`, { conditions: acmeRule }));
    expect(response.status).toBe(200);
    expect((await json<{ count: number }>(response)).data).toEqual({ count: 1 });
    expect(await db.segment.count()).toBe(before);
  });

  it('reach refuses a rule the save gate would refuse', async () => {
    const response = await ownerFetch(
      post(`/api/v1/space/${space.id}/segments/reach`, {
        conditions: { field: 'customerUser.platformRole', operator: Operator.equals, value: 'superadmin' },
      }),
    );
    expect(response.status).toBe(422);
  });

  it('reach refuses a rule naming a segment the owner does not have', async () => {
    const elsewhere = (await createSpace({}, { organization: org })).entity;
    const { entity: foreign } = await createSegment({ conditions: acmeRule }, { space: elsewhere });
    const response = await ownerFetch(
      post(`/api/v1/space/${space.id}/segments/reach`, { conditions: membersOf(foreign.id) }),
    );
    expect(response.status).toBe(422);
  });

  it('reach is offered wherever a segment can be created: me and organization as provider', async () => {
    const mine = await ownerFetch(post('/api/v1/me/segments/reach', { conditions: acmeRule }));
    expect(mine.status).toBe(200);
    expect((await json<{ count: number }>(mine)).data).toEqual({ count: 0 });

    const orgs = await ownerFetch(post(`/api/v1/organization/${org.id}/segments/reach`, { conditions: acmeRule }));
    expect(orgs.status).toBe(200);
    expect((await json<{ count: number }>(orgs)).data).toEqual({ count: 0 });
  });

  it('deleting a segment tells its members: the member-side removal event names the segment', async () => {
    const response = await ownerFetch(del(`/api/v1/segment/${segment.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.appEvent.findMany({
      where: { name: 'segment.deleted', data: { path: ['segment', 'id'], equals: segment.id } },
    });
    expect(deleted).toHaveLength(1);

    const removed = await db.appEvent.findMany({
      where: { name: 'customerRef.segmentsRemoved', data: { path: ['customerRefId'], equals: customerRef.id } },
    });
    expect(removed.map((event) => (event.data as { segmentIds: string[] }).segmentIds)).toContainEqual([segment.id]);
  });
});
