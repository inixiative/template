import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { Organization, OrganizationUser, Segment, User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createFeatureFlag,
  createOrganization,
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
import { createVariant } from '#/modules/featureFlag/services/writeVariant';
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
  sample: { from: number; to: number } | null;
  segment: { id: string; members: number; featureFlagInternal: boolean; deletedAt: string | null } | null;
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

  it('an organization admin creates a custom: boolean flag and gets its on variant over an internal open segment', async () => {
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
    expect(flag.variants[0]!.segment?.featureFlagInternal).toBe(true);
  });

  it('the internal segment is hidden from the owner’s segment list and the member sees the value', async () => {
    const listed = await ownerFetch(get(`/api/v1/organization/${org.id}/segments`));
    expect((await json<Segment[]>(listed)).data.map((each) => each.id)).not.toContain(flag.variants[0]!.segmentId);

    const values = await memberFetch(get('/api/v1/me/featureFlagValues'));
    expect(values.status).toBe(200);
    const mine = (await json<Value[]>(values)).data.find((each) => each.slug === 'custom:dark-mode');
    expect(mine).toMatchObject({ ownerModel: 'Organization', ownerId: org.id, customerId: member.id, value: true });

    const memberships = await memberFetch(get('/api/v1/me/segmentMemberships'));
    expect(memberships.status).toBe(200);
    const segmentIds = (await json<{ segmentId: string }[]>(memberships)).data.map((each) => each.segmentId);
    expect(segmentIds).not.toContain(flag.variants[0]!.segmentId);
  });

  it('a string flag takes ordered variants over shared and internal audiences; a position update reorders', async () => {
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

    const internal = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'rollout',
        internalSegment: {
          type: 'dynamic',
          conditions: { field: 'customerUser.email', operator: Operator.endsWith, value: domain },
        },
        valueText: 'classic',
      }),
    );
    expect(internal.status).toBe(201);
    const rollout = (await json<Variant>(internal)).data;
    expect(rollout.segment?.featureFlagInternal).toBe(true);

    const sampled = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'half',
        segmentId: audience.id,
        sample: { from: 0, to: 50 },
        valueText: 'half',
      }),
    );
    expect(sampled.status).toBe(201);
    const half = (await json<Variant>(sampled)).data;
    expect(half.sample).toEqual({ from: 0, to: 50 });
    expect((await ownerFetch(del(`/api/v1/featureFlagVariant/${half.id}`))).status).toBe(204);

    const inverted = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'inverted',
        segmentId: audience.id,
        sample: { from: 60, to: 40 },
        valueText: 'x',
      }),
    );
    expect(inverted.status).toBe(400);
    expect(theme).not.toHaveProperty('sampleOffset');

    const both = await ownerFetch(
      post(`/api/v1/featureFlag/${theme.id}/featureFlagVariants`, {
        label: 'wrong',
        segmentId: audience.id,
        internalSegment: { type: 'dynamic', conditions: { all: [] } },
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

    const relabeled = await ownerFetch(patch(`/api/v1/featureFlagVariant/${rollout.id}`, { label: 'staged' }));
    expect(relabeled.status).toBe(200);
    const renamed = await db.segment.findUnique({ where: { id: rollout.segmentId! } });
    expect(renamed?.name).toBe('custom:theme/staged');
  });

  it('internal names never collide: a second flag reuses a label and the owner names a shared segment the same', async () => {
    const created = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'custom:theme-next',
        name: 'Theme next',
        subjectModel: 'User',
        valueType: 'string',
      }),
    );
    const next = (await json<Flag>(created)).data;
    const staged = await ownerFetch(
      post(`/api/v1/featureFlag/${next.id}/featureFlagVariants`, {
        label: 'staged',
        internalSegment: { type: 'dynamic', conditions: { all: [] } },
        valueText: 'x',
      }),
    );
    expect(staged.status).toBe(201);

    const shared = await ownerFetch(
      post(`/api/v1/organization/${org.id}/segments`, {
        name: 'custom:theme-next/staged',
        type: 'static',
        conditions: { field: 'id', operator: Operator.in, value: [] },
      }),
    );
    expect(shared.status).toBe(201);
  });

  it('a tombstoned shared audience shows as deleted on the owner’s read', async () => {
    const { entity: doomed } = await createSegment({
      ownerModel: 'Organization',
      organization: org,
      type: 'static',
      conditions: { field: 'id', operator: Operator.in, value: [] },
    });
    const created = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'custom:doomed',
        name: 'Doomed',
        subjectModel: 'User',
        valueType: 'boolean',
      }),
    );
    const doomedFlag = (await json<Flag>(created)).data;
    const variant = await ownerFetch(
      post(`/api/v1/featureFlag/${doomedFlag.id}/featureFlagVariants`, {
        label: 'dead',
        segmentId: doomed.id,
        valueBoolean: true,
      }),
    );
    expect(variant.status).toBe(201);
    expect((await json<Variant>(variant)).data.segment?.deletedAt).toBeNull();

    expect((await ownerFetch(del(`/api/v1/segment/${doomed.id}`))).status).toBe(204);
    const read = (await json<Flag>(await ownerFetch(get(`/api/v1/featureFlag/${doomedFlag.id}`)))).data;
    const dead = read.variants.find((each) => each.label === 'dead');
    expect(dead?.segment?.id).toBe(doomed.id);
    expect(dead?.segment?.deletedAt).not.toBeNull();
  });

  it('deleting a variant tombstones its internal segment; a member cannot manage the flag', async () => {
    const onVariant = flag.variants[0]!;
    expect((await memberFetch(patch(`/api/v1/featureFlag/${flag.id}`, { enabled: false }))).status).toBe(403);

    const deleted = await ownerFetch(del(`/api/v1/featureFlagVariant/${onVariant.id}`));
    expect(deleted.status).toBe(204);
    const internal = await db.segment.findUnique({ where: { id: onVariant.segmentId! } });
    expect(internal?.deletedAt).not.toBeNull();

    const values = (await json<Value[]>(await memberFetch(get('/api/v1/me/featureFlagValues')))).data;
    expect(values.find((each) => each.slug === 'custom:dark-mode')?.value).toBe(false);
  });

  it('a variant moves internal -> shared -> internal; the old internal is tombstoned and released', async () => {
    const created = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'custom:moving',
        name: 'Moving',
        subjectModel: 'User',
        valueType: 'string',
        enabled: true,
      }),
    );
    const moving = (await json<Flag>(created)).data;
    const first = (
      await json<Variant>(
        await ownerFetch(
          post(`/api/v1/featureFlag/${moving.id}/featureFlagVariants`, {
            label: 'a',
            internalSegment: { type: 'dynamic', conditions: { all: [] } },
            valueText: 'one',
          }),
        ),
      )
    ).data;
    const firstInternal = first.segmentId!;

    const toShared = await ownerFetch(patch(`/api/v1/featureFlagVariant/${first.id}`, { segmentId: audience.id }));
    expect(toShared.status).toBe(200);
    expect((await json<Variant>(toShared)).data.segmentId).toBe(audience.id);
    const released = await db.segment.findUnique({ where: { id: firstInternal } });
    expect(released?.deletedAt).not.toBeNull();

    const backInternal = await ownerFetch(
      patch(`/api/v1/featureFlagVariant/${first.id}`, {
        internalSegment: { type: 'dynamic', conditions: { all: [] } },
      }),
    );
    expect(backInternal.status).toBe(200);
    const again = (await json<Variant>(backInternal)).data;
    expect(again.segment?.featureFlagInternal).toBe(true);
    expect(again.segmentId).not.toBe(firstInternal);
  });

  it('a deleted label and a deleted slug can be reused', async () => {
    const recreated = await ownerFetch(
      post(`/api/v1/featureFlag/${flag.id}/featureFlagVariants`, {
        label: 'on',
        internalSegment: { type: 'dynamic', conditions: { all: [] } },
        valueBoolean: true,
      }),
    );
    expect(recreated.status).toBe(201);

    const removed = await ownerFetch(del(`/api/v1/featureFlag/${flag.id}`));
    expect(removed.status).toBe(204);
    const variants = await db.featureFlagVariant.findMany({
      where: { featureFlagId: flag.id, deletedAt: { not: null } },
    });
    expect(variants.length).toBeGreaterThan(0);
    const internals = await db.segment.findMany({
      where: {
        id: { in: variants.map((each) => each.segmentId!) },
        featureFlagInternal: true,
        deletedAt: { not: null },
      },
    });
    expect(internals.length).toBe(variants.length);

    const again = await ownerFetch(
      post(`/api/v1/organization/${org.id}/featureFlags`, {
        slug: 'custom:dark-mode',
        name: 'Dark mode',
        subjectModel: 'User',
        valueType: 'boolean',
      }),
    );
    expect(again.status).toBe(201);
    flag = (await json<Flag>(again)).data;
  });

  it('tombstoning the owner tombstones its flags, variants and internal segments', async () => {
    const { entity: doomed } = await createOrganization();
    const created = await superadminFetch(
      post(`/api/v1/organization/${doomed.id}/featureFlags`, {
        slug: 'custom:doomed',
        name: 'Doomed',
        subjectModel: 'User',
        valueType: 'boolean',
      }),
    );
    expect(created.status).toBe(201);
    const doomedFlag = (await json<Flag>(created)).data;

    await db.organization.update({ where: { id: doomed.id }, data: { deletedAt: new Date() } });
    expect(await db.featureFlag.findFirst({ where: { id: doomedFlag.id, deletedAt: { not: null } } })).not.toBeNull();
    expect(
      await db.featureFlagVariant.findFirst({ where: { id: doomedFlag.variants[0]!.id, deletedAt: { not: null } } }),
    ).not.toBeNull();
    expect(
      await db.segment.findFirst({ where: { id: doomedFlag.variants[0]!.segmentId!, deletedAt: { not: null } } }),
    ).not.toBeNull();
  });

  it('featureFlagInternal is not writable through the segment API', async () => {
    const created = await ownerFetch(
      post(`/api/v1/organization/${org.id}/segments`, {
        name: `sneaky-${getNextSeq()}`,
        type: 'static',
        conditions: { all: [] },
        featureFlagInternal: true,
      }),
    );
    expect(created.status).toBe(400);
    const flipped = await ownerFetch(patch(`/api/v1/segment/${audience.id}`, { featureFlagInternal: true }));
    expect(flipped.status).toBe(400);
    expect((await db.segment.findUnique({ where: { id: audience.id } }))?.featureFlagInternal).toBe(false);
  });

  it('two variants racing for one orphaned internal segment: exactly one wins', async () => {
    const { entity: raceFlag } = await createFeatureFlag({
      slug: `custom:race-${getNextSeq()}`,
      ownerModel: 'Organization',
      organization: org,
      valueType: 'boolean',
    });
    const { entity: orphan } = await createSegment({
      ownerModel: 'Organization',
      organization: org,
      featureFlagInternal: true,
    });
    const outcomes = await Promise.allSettled([
      createVariant(raceFlag, { label: 'a', segmentId: orphan.id, valueBoolean: true }),
      createVariant(raceFlag, { label: 'b', segmentId: orphan.id, valueBoolean: false }),
    ]);
    expect(outcomes.filter((each) => each.status === 'fulfilled')).toHaveLength(1);
    const referrers = await db.featureFlagVariant.findMany({ where: { segmentId: orphan.id, deletedAt: null } });
    expect(referrers).toHaveLength(1);
  });

  it('the superadmin creates a bare platform flag and lists every owner’s flags', async () => {
    const created = await superadminFetch(
      post('/api/admin/featureFlag', { slug: 'new-nav', name: 'New nav', subjectModel: 'User', valueType: 'boolean' }),
    );
    expect(created.status).toBe(201);
    const platformFlag = (await json<Flag>(created)).data;
    expect(platformFlag.ownerModel).toBe('platform');

    const all = await superadminFetch(get('/api/admin/featureFlag'));
    const slugs = (await json<Flag[]>(all)).data.map((each) => each.slug);
    expect(slugs).toContain('new-nav');
    expect(slugs).toContain('custom:dark-mode');
    expect((await ownerFetch(get('/api/admin/featureFlag'))).status).toBe(403);
    expect((await ownerFetch(get(`/api/v1/featureFlag/${platformFlag.id}`))).status).toBe(403);
  });
});
