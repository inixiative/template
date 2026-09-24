import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry } from '@template/db';
import type { Organization, OrganizationUser, Segment, User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createOrganizationUser,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { organizationRouter } from '#/modules/organization';
import { segmentRouter } from '#/modules/segment';
import { adminRouter } from '#/routes/admin';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

const domain = `@platform-${getNextSeq()}.test`;
const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: domain };

describe('admin/segment', () => {
  let superadminFetch: ReturnType<typeof createTestApp>['fetch'];
  let orgAdminFetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let orgUser: OrganizationUser;
  let platformCustomer: User;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();

    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { entity: ou, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = ou;
    org = context.organization;

    platformCustomer = (await createUser({ email: `platform-${getNextSeq()}${domain}` })).entity;
    await createCustomerRef({ customerModel: 'User', providerModel: 'platform', customerUser: platformCustomer });
    const orgCustomer = (await createUser({ email: `org-${getNextSeq()}${domain}` })).entity;
    await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Organization',
      customerUser: orgCustomer,
      providerOrganization: org,
    });

    const mount: MountFn[] = [
      (app) => {
        app.route('/api/admin', adminRouter);
        app.route('/api/v1/segment', segmentRouter);
        app.route('/api/v1/organization', organizationRouter);
      },
    ];
    const harness = createTestApp({ mockUser: superadmin, mount });
    superadminFetch = harness.fetch;
    db = harness.db;
    orgAdminFetch = createTestApp({ mockUser: context.user, mockOrganizationUsers: [orgUser], mount }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  let segment: Segment;

  it('the superadmin creates a platform segment and it reconciles over platform customers only', async () => {
    const response = await superadminFetch(
      post('/api/admin/segment', { name: `platform-acme-${getNextSeq()}`, type: 'dynamic', conditions: acmeRule }),
    );
    expect(response.status).toBe(201);
    segment = (await json<Segment>(response)).data;
    expect(segment.ownerModel).toBe('platform');
    expect(segment.userId).toBeNull();
    expect(segment.organizationId).toBeNull();

    const members = await superadminFetch(get(`/api/v1/segment/${segment.id}/segmentMembers`));
    const { data } = await json<{ customerRef: { customerUserId: string } }[]>(members);
    expect(data.map((member) => member.customerRef.customerUserId)).toEqual([platformCustomer.id]);
  });

  it('reach counts the platform’s customers, not another provider’s', async () => {
    const response = await superadminFetch(post('/api/admin/segment/reach', { conditions: acmeRule }));
    expect(response.status).toBe(200);
    expect((await json<{ count: number }>(response)).data.count).toBe(1);
  });

  it('the admin list carries every owner’s segments and filters to the platform’s own', async () => {
    const all = await superadminFetch(get('/api/admin/segment'));
    expect(all.status).toBe(200);
    expect((await json<Segment[]>(all)).data.map((each) => each.id)).toContain(segment.id);

    const platformOnly = await superadminFetch(get('/api/admin/segment?searchFields[ownerModel]=platform'));
    const { data } = await json<Segment[]>(platformOnly);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((each) => each.ownerModel === 'platform')).toBe(true);
  });

  it('an organization admin is refused the admin routes and cannot read a platform segment', async () => {
    expect((await orgAdminFetch(get('/api/admin/segment'))).status).toBe(403);
    expect((await orgAdminFetch(post('/api/admin/segment', { name: 'x', conditions: acmeRule }))).status).toBe(403);
    expect((await orgAdminFetch(get(`/api/v1/segment/${segment.id}`))).status).toBe(403);

    const owned = await orgAdminFetch(get(`/api/v1/organization/${org.id}/segments`));
    expect(owned.status).toBe(200);
    expect((await json<Segment[]>(owned)).data.map((each) => each.id)).not.toContain(segment.id);
  });
});
