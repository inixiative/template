import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type {
  Organization,
  OrganizationUser,
  Token,
  User,
} from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { adminAuditLogRouter } from '#/modules/admin/auditLog';
import type { auditLogReadManyRoute } from '#/modules/admin/auditLog/routes/auditLogReadMany';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type ReadManyResponse = z.infer<typeof auditLogReadManyRoute.responseSchema>[];

const readEntitlement = (organizationId: string) => ({
  resource: 'Organization' as const,
  actions: ['read'],
  sourceModel: 'Organization' as const,
  sourceId: organizationId,
});

describe('GET /api/admin/auditLog: a record and its children in one stream', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let organization: Organization;
  let member: OrganizationUser;
  let token: Token;

  beforeEach(async () => {
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    ({ entity: organization } = await createOrganization());
    ({ entity: member } = await createOrganizationUser({}, { organization }));
    ({ entity: token } = await createToken(
      { ownerModel: 'OrganizationUser', entitlements: [readEntitlement(organization.id)] },
      { organizationUser: member },
    ));
    const harness = createTestApp({
      mockUser: superadmin as User,
      mount: [(app) => app.route('/api/admin/auditLog', adminAuditLogRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const tombstoneEntitlements = async () => {
    await db.entitlement.updateManyAndReturn({
      where: { targetModel: 'Token', targetId: token.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  };

  const read = async (query: string) => {
    const response = await fetch(get(`/api/admin/auditLog?pageSize=100&${query}`));
    expect(response.status).toBe(200);
    return (await json<ReadManyResponse>(response)).data;
  };

  it("a token's history holds its own events and its entitlement rows' create and delete, newest first", async () => {
    const [row] = await db.entitlement.findMany({ where: { targetId: token.id } });
    await tombstoneEntitlements();

    const history = await read(`historyModel=Token&historyId=${token.id}`);

    expect(history.map(({ subjectModel, action }) => `${subjectModel}:${action}`)).toEqual([
      'Entitlement:delete',
      'Entitlement:create',
      'Token:create',
    ]);
    expect(history.filter((entry) => entry.subjectModel === 'Entitlement')).toEqual([
      expect.objectContaining({ subjectEntitlementId: row!.id }),
      expect.objectContaining({ subjectEntitlementId: row!.id }),
    ]);
  });

  it("a token's history leaves out another token's entitlements", async () => {
    await createToken(
      { ownerModel: 'OrganizationUser', entitlements: [readEntitlement(organization.id)] },
      { organizationUser: member },
    );

    const history = await read(`historyModel=Token&historyId=${token.id}`);

    expect(history).toHaveLength(2);
  });

  it("an organization's audit view holds the entitlement changes on its members' tokens", async () => {
    await tombstoneEntitlements();

    const view = await read(`searchFields[contextOrganizationId]=${organization.id}`);
    const entitlementEntries = view.filter(
      (entry) =>
        entry.subjectModel === 'Entitlement' &&
        ((entry.after ?? entry.before) as { targetId?: string }).targetId === token.id,
    );

    expect(entitlementEntries.map(({ action }) => action)).toEqual(['delete', 'create']);
    expect(entitlementEntries).toEqual([
      expect.objectContaining({
        contextOrganizationId: organization.id,
        contextUserId: member.userId,
      }),
      expect.objectContaining({
        contextOrganizationId: organization.id,
        contextUserId: member.userId,
      }),
    ]);
  });

  it('a history filter names both the model and the id', async () => {
    const response = await fetch(get('/api/admin/auditLog?historyModel=Token'));
    expect(response.status).toBe(422);
  });
});
