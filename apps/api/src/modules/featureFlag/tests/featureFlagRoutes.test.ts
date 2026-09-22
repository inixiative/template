import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { Organization, OrganizationUser, Segment, User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createOrganizationUser,
  createSegment,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { emitAppEvent } from '#/appEvents/emit';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerFeatureFlagHook } from '#/hooks/featureFlag/hook';
import { registerFeatureFlagVariantHook } from '#/hooks/featureFlagVariant/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { featureFlagRouter } from '#/modules/featureFlag';
import { featureFlagVariantRouter } from '#/modules/featureFlagVariant';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { segmentRouter } from '#/modules/segment';
import { adminRouter } from '#/routes/admin';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, get, json, patch, post } from '#tests/utils/request';

type Variant = {
  id: string;
  label: string;
  position: number;
  segmentId: string | null;
  segment: { id: string; members: number; featureFlagVariantId: string | null } | null;
};
type Flag = { id: string; slug: string; ownerModel: string; enabled: boolean; variants: Variant[] };
type Value = {
  ownerModel: string;
  ownerId: string;
  customerModel: string;
  customerId: string;
  slug: string;
  value: unknown;
};

describe('feature flag routes', () => {
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];
  let memberFetch: ReturnType<typeof createTestApp>['fetch'];
  let superadminFetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let orgUser: OrganizationUser;
  let owner: User;
  let member: User;
  let audience: Segment;

  const domain = `@flags-${getNextSeq()}.test`;

  beforeAll(async () => {
    registerClearCacheHook();
    registerFeatureFlagHook();
    registerFeatureFlagVariantHook();
    registerOrderedListHook();
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();
    registerSoftDeleteCascadeHook();
    const { entity: ou, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = ou;
    owner = context.user;
    org = context.organization;
    member = (await createUser({ email: `member-${getNextSeq()}${domain}` })).entity;
    const { entity: memberOu } = await createOrganizationUser({ role: 'member' }, { organization: org, user: member });
    await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Organization',
      customerUser: member,
      providerOrganization: org,
    });
    audience = (
      await createSegment({
        ownerModel: 'Organization',
        organization: org,
        type: 'dynamic',
        conditions: { field: 'customerUser.email', operator: Operator.endsWith, value: domain },
      })
    ).entity;
    await emitAppEvent('segment.created', { segment: audience });
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });

    const mount: MountFn[] = [
      (app) => {
        app.route('/api/admin', adminRouter);
        app.route('/api/v1/featureFlag', featureFlagRouter);
        app.route('/api/v1/featureFlagVariant', featureFlagVariantRouter);
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
        app.route('/api/v1/segment', segmentRouter);
      },
    ];
    const harness = createTestApp({ mockUser: owner, mockOrganizationUsers: [orgUser], mount });
    ownerFetch = harness.fetch;
    testDb = harness.db;
    memberFetch = createTestApp({ mockUser: member, mockOrganizationUsers: [memberOu], mount }).fetch;
    superadminFetch = createTestApp({ mockUser: superadmin, mount }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
    clearHookRegistry();
  });

  let flag: Flag;

  it('an organization admin creates a custom: boolean flag and gets its on variant over an inline open segment', async () => {
    const refused = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'dark-mode',
        name: 'Dark mode',
        subjectModel: 'User',
        valueType: 'boolean',
      }),
    );
    expect(refused.status).toBe(422);

    const response = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'custom:dark-mode',
        name: 'Dark mode',
        subjectModel: 'User',
        valueType: 'boolean',
        enabled: true,
      }),
    );
    expect(response.status).toBe(201);
    flag = (await json<Flag>(response)).data;
    expect(flag.ownerModel).toBe('Organization');
    expect(flag.variants).toHaveLength(1);
    expect(flag.variants[0]!.label).toBe('on');
    expect(flag.variants[0]!.segment?.featureFlagVariantId).toBe(flag.variants[0]!.id);
  });

  it('the inline segment is hidden from the owner’s segment list and the member sees the value', async () => {
    const listed = await ownerFetch(get(`/api/v1/organization/${org.id}/segments`));
    expect((await json<Segment[]>(listed)).data.map((each) => each.id)).not.toContain(flag.variants[0]!.segmentId);

    const values = await memberFetch(get('/api/v1/me/featureFlagValues'));
    expect(values.status).toBe(200);
    const mine = (await json<Value[]>(values)).data.find((each) => each.slug === 'custom:dark-mode');
    expect(mine).toMatchObject({ ownerModel: 'Organization', ownerId: org.id, customerId: member.id, value: true });
  });

  it('a string flag takes ordered variants over shared and sampled audiences; a position update reorders', async () => {
    const created = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'custom:theme',
        name: 'Theme',
        subjectModel: 'User',
        valueType: 'string',
        enabled: true,
      }),
    );
    const theme = (await json<Flag>(created)).data;
    expect(theme.variants).toHaveLength(0);

    const shared = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'beta',
        segmentId: audience.id,
        valueText: 'compact',
      }),
    );
    expect(shared.status).toBe(201);
    const beta = (await json<Variant>(shared)).data;
    expect(beta.segment?.id).toBe(audience.id);

    const sampled = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'rollout',
        sample: { percent: 100, from: audience.id },
        valueText: 'classic',
      }),
    );
    expect(sampled.status).toBe(201);
    const rollout = (await json<Variant>(sampled)).data;
    expect(rollout.segment?.featureFlagVariantId).toBe(rollout.id);

    const both = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'wrong',
        segmentId: audience.id,
        sample: { percent: 10 },
        valueText: 'x',
      }),
    );
    expect(both.status).toBe(422);

    const before = (await json<Value[]>(await memberFetch(get('/api/v1/me/featureFlagValues')))).data;
    expect(before.find((each) => each.slug === 'custom:theme')?.value).toBe('compact');

    const moved = await ownerFetch(patch(`/api/v1/featureFlagVariant/${rollout.id}`, { position: 0 }));
    expect(moved.status).toBe(200);
    const after = (await json<Value[]>(await memberFetch(get('/api/v1/me/featureFlagValues')))).data;
    expect(after.find((each) => each.slug === 'custom:theme')?.value).toBe('classic');

    const read = (await json<Flag>(await ownerFetch(get(`/api/v1/featureFlag/${theme.id}`)))).data;
    expect(read.variants.map((each) => each.label)).toEqual(['rollout', 'beta']);
    expect(read.variants[0]!.segment?.members).toBe(1);
  });

  it('deleting a variant tombstones its inline segment; a member cannot manage the flag', async () => {
    const onVariant = flag.variants[0]!;
    expect((await memberFetch(patch(`/api/v1/featureFlag/${flag.id}`, { enabled: false }))).status).toBe(403);

    const deleted = await ownerFetch(del(`/api/v1/featureFlagVariant/${onVariant.id}`));
    expect(deleted.status).toBe(204);
    const inline = await db.segment.findUnique({ where: { id: onVariant.segmentId! } });
    expect(inline?.deletedAt).not.toBeNull();

    const values = (await json<Value[]>(await memberFetch(get('/api/v1/me/featureFlagValues')))).data;
    expect(values.find((each) => each.slug === 'custom:dark-mode')?.value).toBe(false);
  });

  it('the superadmin creates a bare platform flag and lists every owner’s flags', async () => {
    const created = await superadminFetch(
      post('/api/admin/featureFlag', { slug: 'new-nav', name: 'New nav', subjectModel: 'User', valueType: 'boolean' }),
    );
    expect(created.status).toBe(201);
    expect((await json<Flag>(created)).data.ownerModel).toBe('platform');

    const all = await superadminFetch(get('/api/admin/featureFlag'));
    const slugs = (await json<Flag[]>(all)).data.map((each) => each.slug);
    expect(slugs).toContain('new-nav');
    expect(slugs).toContain('custom:dark-mode');
    expect((await ownerFetch(get('/api/admin/featureFlag'))).status).toBe(403);
  });
});
