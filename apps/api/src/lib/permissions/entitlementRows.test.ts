import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cacheKey, checkCache, db, revive, snapshotHookRegistry, toAccessor } from '@template/db';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFlow,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createToken,
} from '@template/db/test';
import { type EntitlementEntry, memberSelfGrant, type Permix } from '@template/permissions';
import { rebacSchema } from '@template/permissions/rebac';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerDelegatedKeysHook } from '#/hooks/falsePolymorphism/delegatedKeysHook';
import { registerFullDelegateHook } from '#/hooks/fullDelegate/hook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRuleReferenceHook } from '#/hooks/ruleReference/hook';
import { registerRuleReferenceTargetHook } from '#/hooks/ruleReference/targetHook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { userPermissions } from '#/lib/permissions/userPermissions';
import { integrationRouter } from '#/modules/integration';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import {
  entitlementIds,
  grantEntitlements,
  heldEntitlements,
  revokeEntitlements,
} from '#tests/utils/entitlements';
import { get, patch } from '#tests/utils/request';

let restoreHooks: () => void;
let organization: Organization;
let owner: { user: User; member: OrganizationUser; permix: Permix };

const readOrganization = (): EntitlementEntry =>
  entry('db:organization', ['db:organization', organization.id], ['read']) as EntitlementEntry;
const readSpace = (spaceId: string): EntitlementEntry =>
  entry('db:space', ['db:space', spaceId], ['read']) as EntitlementEntry;

const rowsOf = (model: 'Token' | 'Integration' | 'OrganizationUser', id: string) =>
  db.withDeleted(() =>
    db.entitlement.findMany({
      where: { targetModel: model, targetId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  );

beforeEach(async () => {
  restoreHooks = snapshotHookRegistry();
  registerDelegatedKeysHook();
  registerFullDelegateHook();
  registerMemberSelfGrantHook();
  registerRulesHook();
  registerAuditLogHook();
  registerClearCacheHook();
  registerImmutableFieldsHook();
  registerPreventHardDeleteHook();
  registerRuleReferenceHook();
  registerRuleReferenceTargetHook();
  registerSoftDeleteCascadeHook();
  ({ entity: organization } = await createOrganization());
  const { entity: member, context } = await createOrganizationUser(
    { role: 'owner' },
    { organization },
  );
  owner = { user: context.user, member, permix: (await userPermissions(context.user.id))! };
});

afterEach(async () => {
  restoreHooks();
  await cleanupTouchedTables(db);
});

describe('the entitlement table: the source names the anchor, the target holds it (Aron, 2026-11-02)', () => {
  it('the source and resource models are the rebac resources, one for one', () => {
    expect(
      Object.values(EntitlementResourceModel)
        .map((model) => `db:${toAccessor(model)}`)
        .sort(),
    ).toEqual(Object.keys(rebacSchema.permissions).sort());
  });

  it('one audit entry per row, on create-many and on delete-many', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
    });
    const target = { model: 'Integration' as const, id: integration.id };
    await changeEntitlements(owner.permix, target, {
      add: [readOrganization(), readSpace(space.id)],
    });
    const ids = (await rowsOf('Integration', integration.id)).map((row) => row.id);
    await changeEntitlements(owner.permix, target, { remove: ids });

    const audits = await db.auditLog.findMany({
      where: { subjectModel: 'Entitlement', subjectEntitlementId: { in: ids } },
    });
    expect(audits.filter((audit) => audit.action === 'create')).toHaveLength(2);
    expect(audits.filter((audit) => audit.action === 'delete')).toHaveLength(2);
  });

  it('a full delegate takes no entitlements', async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: owner.user.id,
      full: true,
    });
    await expect(
      changeEntitlements(
        owner.permix,
        { model: 'Integration', id: integration.id },
        { add: [readOrganization()] },
      ),
    ).rejects.toThrow('full takes no entitlements');
  });
});

describe('rows live and die with their target', () => {
  it('tombstone with the target and revive with it; a row removed before stays removed', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
      entitlements: [readOrganization(), readSpace(space.id)],
    });
    const target = { model: 'Integration' as const, id: integration.id };
    const [removedFirst] = await entitlementIds(target, [readSpace(space.id)]);
    await changeEntitlements(owner.permix, target, { remove: [removedFirst!] });

    const removedAt = new Date();
    await db.integration.update({ where: { id: integration.id }, data: { deletedAt: removedAt } });
    const tombstoned = await rowsOf('Integration', integration.id);
    expect(tombstoned.every((row) => row.deletedAt != null)).toBe(true);
    expect(tombstoned.find((row) => row.id !== removedFirst)?.deletedAt).toEqual(removedAt);

    await revive(db.integration, { id: integration.id });
    expect(await heldEntitlements(target)).toEqual([readOrganization()]);
  });

  it('a token never revives, and its rows stay dead when its member is revived', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: token } = await createToken(
      { ownerModel: 'OrganizationUser', role: null, entitlements: [readOrganization()] },
      { organizationUser: member },
    );

    await db.organizationUser.update({ where: { id: member.id }, data: { deletedAt: new Date() } });
    await revive(db.organizationUser, { id: member.id });

    expect(await db.token.findUnique({ where: { id: token.id } })).toBeNull();
    expect((await rowsOf('Token', token.id)).map((row) => row.deletedAt != null)).toEqual([true]);
    expect(await heldEntitlements({ model: 'OrganizationUser', id: member.id })).toEqual([
      memberSelfGrant('db:organizationUser', member),
    ]);
  });
});

describe('a gone anchor is stamped on the row, like a rule reference target', () => {
  it('a tombstoned source sets sourceDeletedAt, a revived one clears it', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: token } = await createToken(
      { ownerModel: 'Organization', role: 'viewer', entitlements: [readSpace(space.id)] },
      { organization },
    );
    const deletedAt = new Date();
    await db.space.update({ where: { id: space.id }, data: { deletedAt } });
    expect((await rowsOf('Token', token.id))[0]?.sourceDeletedAt).toEqual(deletedAt);

    await revive(db.space, { id: space.id });
    expect((await rowsOf('Token', token.id))[0]?.sourceDeletedAt).toBeNull();
  });

  it('a purged source nulls the typed FK and keeps sourceId; the row still dies with its target', async () => {
    const { entity: flow } = await createFlow({}, { user: owner.user });
    const { entity: token } = await createToken(
      {
        ownerModel: 'OrganizationUser',
        role: 'viewer',
        entitlements: [entry('db:flow', ['db:flow', flow.id], ['read'])],
      },
      { organizationUser: owner.member },
    );
    await db.flow.delete({ where: { id: flow.id } });

    const [purged] = await rowsOf('Token', token.id);
    expect(purged).toMatchObject({ sourceId: flow.id, sourceFlowId: null });

    await db.token.update({ where: { id: token.id }, data: { deletedAt: new Date() } });
    expect((await rowsOf('Token', token.id))[0]?.deletedAt).not.toBeNull();
  });
});

describe('the writer keeps its invariants under a lock on the target', () => {
  it('two writers adding the same entry at once store it once', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: token } = await createToken(
      { ownerModel: 'Organization', role: 'viewer' },
      { organization },
    );
    const target = { model: 'Token' as const, id: token.id };

    await Promise.all([
      changeEntitlements(owner.permix, target, { add: [readSpace(space.id)] }),
      changeEntitlements(owner.permix, target, { add: [readSpace(space.id)] }),
    ]);
    expect(await heldEntitlements(target)).toEqual([readSpace(space.id)]);
  });

  it('a role-less delegate whose last rows are removed at once holds nothing; neither removal is refused', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: token } = await createToken(
      {
        ownerModel: 'Organization',
        role: null,
        entitlements: [readOrganization(), readSpace(space.id)],
      },
      { organization },
    );
    const target = { model: 'Token' as const, id: token.id };
    const [first, second] = (await rowsOf('Token', token.id)).map((row) => row.id);

    await Promise.all([
      changeEntitlements(owner.permix, target, { remove: [first!] }),
      changeEntitlements(owner.permix, target, { remove: [second!] }),
    ]);
    expect(await heldEntitlements(target)).toEqual([]);
  });

  it("the self-grant is refused to its own user's delete-many; only the member's tombstone takes it", async () => {
    const { entity: member, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [owner.member, member],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    const target = { model: 'OrganizationUser' as const, id: member.id };
    const [selfGrant] = await entitlementIds(target, [
      memberSelfGrant('db:organizationUser', member),
    ]);
    expect((await revokeEntitlements(app, target, [selfGrant!])).status).toBe(422);
    expect(await heldEntitlements(target)).toEqual([
      memberSelfGrant('db:organizationUser', member),
    ]);
  });
});

describe('a revoked row is denied on the very next token request (cache)', () => {
  it('signing in with the token reads its rows again after the revoke', async () => {
    const { call, holds } = createTokenProbeApp();
    const { entity: space } = await createSpace({}, { organization });
    const { rawKey, entity: token } = await createKeyedToken(
      {
        ownerModel: 'OrganizationUser',
        role: null,
        entitlements: [readSpace(space.id), readOrganization()],
      },
      { organizationUser: owner.member },
    );
    expect(await holds(rawKey, 'space', space.id, 'read')).toBe(true);

    const target = { model: 'Token' as const, id: token.id };
    await changeEntitlements(owner.permix, target, {
      remove: await entitlementIds(target, [readSpace(space.id)]),
    });

    expect(await holds(rawKey, 'space', space.id, 'read')).toBe(false);
    expect((await call(rawKey, 'GET', '/api/v1/probe/actor')).status).toBe(200);
  });
});

describe('the rows as a sub-resource of their holder', () => {
  const ownerApp = () =>
    createTestApp({
      mockUser: owner.user,
      mockOrganizationUsers: [owner.member],
      mount: [(hono) => hono.route('/api/v1/integration', integrationRouter)],
    });

  it('a holder lists its rows with ids; a listed id is what delete-many removes', async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
    });
    const target = { model: 'Integration' as const, id: integration.id };
    const app = ownerApp();
    const created = await grantEntitlements(app, target, [readOrganization()]);
    expect(created.status).toBe(201);
    const listed = (await (
      await app.fetch(get(`/api/v1/integration/${integration.id}/entitlements`))
    ).json()) as { data: (EntitlementEntry & { id: string })[] };
    expect(listed.data.map(({ id: _id, ...held }) => held)).toEqual([readOrganization()]);
    expect((await revokeEntitlements(app, target, [listed.data[0]!.id])).status).toBe(204);
    expect(await heldEntitlements(target)).toEqual([]);
  });

  it('an update that makes a delegate full answers without the rows it tombstoned', async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: owner.user.id,
      role: 'viewer',
      entitlements: [readOrganization()],
    });
    const response = await ownerApp().fetch(
      patch(`/api/v1/integration/${integration.id}`, { full: true }),
    );
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { data: { entitlements: unknown[] } }).data.entitlements,
    ).toEqual([]);
  });
});

describe('edges of the lifecycle the review found (2026-11-03)', () => {
  it('a role-less integration holding only rows revives with them', async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: null,
      entitlements: [readOrganization()],
    });
    await db.integration.update({ where: { id: integration.id }, data: { deletedAt: new Date() } });
    await revive(db.integration, { id: integration.id });
    expect(await heldEntitlements({ model: 'Integration', id: integration.id })).toEqual([
      readOrganization(),
    ]);
  });

  it('a row whose anchor is gone can still be removed by whoever writes the holder', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: token } = await createToken(
      { ownerModel: 'Organization', role: 'viewer', entitlements: [readSpace(space.id)] },
      { organization },
    );
    await db.space.update({ where: { id: space.id }, data: { deletedAt: new Date() } });
    const target = { model: 'Token' as const, id: token.id };
    const ids = (await rowsOf('Token', token.id)).map((row) => row.id);
    await changeEntitlements(owner.permix, target, { remove: ids });
    expect(await heldEntitlements(target)).toEqual([]);
  });
});

describe("an entitlement's where names rows as rule-reference edges", () => {
  const selfGrantEdges = (memberId: string) =>
    db.ruleReference.findMany({
      where: { sourceModel: 'Entitlement', targetModel: 'OrganizationUser', targetId: memberId },
    });

  it('a self-grant names its member; the edge goes with the row and comes back with it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    expect(await selfGrantEdges(member.id)).toHaveLength(1);

    await db.organizationUser.update({ where: { id: member.id }, data: { deletedAt: new Date() } });
    expect(await selfGrantEdges(member.id)).toHaveLength(0);

    await revive(db.organizationUser, { id: member.id });
    expect(await selfGrantEdges(member.id)).toHaveLength(1);
  });
});

describe('a revoked token is refused at sign-in, even with its sign-in cached', () => {
  it('the token row cached under its keyHash is cleared when the token is revoked', async () => {
    const { call } = createTokenProbeApp();
    const { rawKey, entity: token } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: null, entitlements: [readOrganization()] },
      { organizationUser: owner.member },
    );
    const actorOf = async () =>
      (
        (await (await call(rawKey, 'GET', '/api/v1/probe/actor')).json()) as {
          actor: { model: string } | null;
        }
      ).actor?.model ?? null;
    expect(await actorOf()).toBe('Token');
    expect((await checkCache(cacheKey('Token', { keyHash: token.keyHash }))).state).not.toBe(
      'empty',
    );

    await db.token.update({ where: { id: token.id }, data: { deletedAt: new Date() } });
    expect(await actorOf()).toBeNull();
  });
});
