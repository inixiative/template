import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { cacheKey, checkCache } from '@template/db';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Project,
  ProjectIntegration,
  Setting,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  AuditAction,
  AuditSubjectModel,
  Role,
  SettingResourceModel,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { projectRouter } from '#/modules/project';
import { projectIntegrationRouter } from '#/modules/projectIntegration';
import { adminSettingRouter, settingRouter } from '#/modules/setting';
import { spaceRouter } from '#/modules/space';
import { spaceUserRouter } from '#/modules/spaceUser';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch } from '#tests/utils/request';

const appFor = (
  user: User,
  organizationUsers: OrganizationUser[],
  spaceUsers: SpaceUser[] = [],
  options?: { superadmin?: boolean },
) =>
  createTestApp({
    mockUser: options?.superadmin ? { ...user, platformRole: 'superadmin' } : user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [
      (app) => app.route('/api/v1/me', meRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
      (app) => app.route('/api/v1/organizationUser', organizationUserRouter),
      (app) => app.route('/api/v1/space', spaceRouter),
      (app) => app.route('/api/v1/spaceUser', spaceUserRouter),
      (app) => app.route('/api/v1/project', projectRouter),
      (app) => app.route('/api/v1/integration', integrationRouter),
      (app) => app.route('/api/v1/projectIntegration', projectIntegrationRouter),
      (app) => app.route('/api/v1/setting', settingRouter),
      (app) => app.route('/api/admin/setting', adminSettingRouter),
    ],
  });

describe('Setting API (parent-scoped GET, atomic batch PATCH, single DELETE, raw Setting[] responses)', () => {
  let owner: User;
  let organization: Organization;
  let ownerMember: OrganizationUser;
  let space: Space;
  let ownerSpaceMember: SpaceUser;
  let orgProject: Project;
  let orgIntegration: Integration;
  let projectIntegration: ProjectIntegration;
  let ownerApp: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    const created = await createOrganizationUser({ role: Role.owner });
    ownerMember = created.entity;
    owner = created.context.user;
    organization = created.context.organization;
    space = (await createSpace({}, { organization })).entity;
    ownerSpaceMember = (
      await createSpaceUser(
        { role: Role.owner },
        { organization, user: owner, organizationUser: ownerMember, space },
      )
    ).entity;
    orgProject = (
      await createProject({ ownerModel: 'Organization', organizationId: organization.id })
    ).entity;
    orgIntegration = (
      await createIntegration({ ownerModel: 'Organization', organizationId: organization.id })
    ).entity;
    projectIntegration = (
      await createProjectIntegration({}, { project: orgProject, integration: orgIntegration })
    ).entity;
    ownerApp = appFor(owner, [ownerMember], [ownerSpaceMember]);
  });

  afterEach(async () => {
    await cleanupTouchedTables(ownerApp.db);
  });

  describe('GET /api/v1/setting/info', () => {
    it('returns minimal starter master-data catalog (general category with defaultTimezone & displayLocale)', async () => {
      const response = await ownerApp.fetch(get('/api/v1/setting/info'));
      expect(response.status).toBe(200);
      const { data } = await parseSuccessBody<{
        guide: Record<string, string>;
        types: {
          categories: Record<string, { key: string; order: number }>;
          definitions: Record<
            string,
            {
              key: string;
              valueType: string;
              schema: Record<string, unknown>;
              defaultValue: unknown;
              permission: unknown;
              readPermission: unknown;
            }
          >;
        };
      }>(response);

      expect(Object.keys(data.guide).length).toBeGreaterThan(0);
      expect(Object.keys(data.types.categories)).toEqual(['general', 'billing']);
      expect(Object.keys(data.types.definitions).sort()).toEqual([
        'billing.allowOrgUserBilling',
        'billing.allowSpaceBilling',
        'billing.allowSpaceUserBilling',
        'billing.shareAccountsWithMembers',
        'general.defaultTimezone',
        'general.displayLocale',
      ]);
      expect(data.types.definitions['general.defaultTimezone']).toMatchObject({
        valueType: 'text',
        defaultValue: 'UTC',
        permission: 'manage',
        readPermission: 'read',
      });
      expect(data.types.definitions['general.displayLocale']).toMatchObject({
        valueType: 'text',
        defaultValue: 'en',
        permission: { default: 'manage', OrganizationUser: 'operate', SpaceUser: 'operate' },
        readPermission: { default: 'read', OrganizationUser: 'operate', SpaceUser: 'operate' },
      });
    });
  });

  describe('Parent-scoped raw GET, atomic batch PATCH, single GET/DELETE, and AuditLog across all 8 owners', () => {
    it('supports /v1/me/settings batch upsert, raw Setting[] reads, in-place update, single DELETE reset, and AuditLog', async () => {
      // Initially empty array (raw stored rows only)
      const initial = await ownerApp.fetch(get('/api/v1/me/settings'));
      expect(initial.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(initial)).data).toEqual([]);

      // Batch PATCH creates both settings atomically and returns raw Setting[] (no value/storedValue DTO)
      const createdRes = await ownerApp.fetch(
        patch('/api/v1/me/settings', [
          { key: 'general.displayLocale', value: 'es' },
          { key: 'general.defaultTimezone', value: 'America/New_York' },
        ]),
      );
      expect(createdRes.status).toBe(200);
      const { data: savedRows } = await parseSuccessBody<Setting[]>(createdRes);
      expect(savedRows.map((r) => r.key)).toEqual([
        'general.defaultTimezone',
        'general.displayLocale',
      ]);
      expect(savedRows[0]).toMatchObject({
        resourceModel: 'User',
        resourceId: owner.id,
        resourceUserId: owner.id,
        valueText: 'America/New_York',
        valueBoolean: null,
        valueNumber: null,
        valueDate: null,
        valueJson: null,
        disabled: false,
      });
      expect('value' in (savedRows[0] as Record<string, unknown>)).toBe(false);

      // Update one setting in place (same row ID!) and disable it
      const tzId = savedRows[0]?.id ?? '';
      const updatedRes = await ownerApp.fetch(
        patch('/api/v1/me/settings', [
          { key: 'general.defaultTimezone', value: 'Europe/London', disabled: true },
        ]),
      );
      expect(updatedRes.status).toBe(200);
      const { data: updatedRows } = await parseSuccessBody<Setting[]>(updatedRes);
      expect(updatedRows[0]?.id).toBe(tzId);
      expect(updatedRows[0]?.valueText).toBe('Europe/London');
      expect(updatedRows[0]?.disabled).toBe(true);

      // Saving a new value over a disabled row without passing disabled re-enables it (disabled: false)
      const reenabledRes = await ownerApp.fetch(
        patch('/api/v1/me/settings', [{ key: 'general.defaultTimezone', value: 'Europe/Paris' }]),
      );
      expect(reenabledRes.status).toBe(200);
      const { data: reenabledRows } = await parseSuccessBody<Setting[]>(reenabledRes);
      expect(reenabledRows[0]?.id).toBe(tzId);
      expect(reenabledRows[0]?.valueText).toBe('Europe/Paris');
      expect(reenabledRows[0]?.disabled).toBe(false);

      // Filter GET by key
      const filtered = await ownerApp.fetch(get('/api/v1/me/settings?key=general.defaultTimezone'));
      expect(filtered.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(filtered)).data.map((r) => r.id)).toEqual([tzId]);

      // Single GET /v1/setting/{id} returns raw SettingScalarSchema
      const single = await ownerApp.fetch(get(`/api/v1/setting/${tzId}`));
      expect(single.status).toBe(200);
      const { data: singleRow } = await parseSuccessBody<Setting>(single);
      expect(singleRow.valueText).toBe('Europe/Paris');
      expect('value' in (singleRow as Record<string, unknown>)).toBe(false);

      // Single DELETE /v1/setting/{id} soft-deletes to reset to default
      expect((await ownerApp.fetch(del(`/api/v1/setting/${tzId}`))).status).toBe(204);
      expect((await ownerApp.fetch(get(`/api/v1/setting/${tzId}`))).status).toBe(404);

      // Re-creating after soft-delete succeeds with a fresh row ID
      const recreated = await ownerApp.fetch(
        patch('/api/v1/me/settings', [{ key: 'general.defaultTimezone', value: 'Asia/Tokyo' }]),
      );
      expect(recreated.status).toBe(200);
      const { data: freshRows } = await parseSuccessBody<Setting[]>(recreated);
      expect(freshRows[0]?.id).not.toBe(tzId);

      // AuditLog recorded create, updates, and delete
      const auditLogs = await ownerApp.db.auditLog.findMany({
        where: { subjectModel: AuditSubjectModel.Setting, subjectSettingId: tzId },
        orderBy: { createdAt: 'asc' },
      });
      expect(auditLogs.map((l) => l.action)).toEqual([
        AuditAction.create,
        AuditAction.update,
        AuditAction.update,
        AuditAction.delete,
      ]);
      expect(auditLogs[0]?.subjectSettingId).toBe(tzId);
    });

    it('exercises Organization, OrganizationUser, Space, SpaceUser, Project, Integration, and ProjectIntegration endpoints', async () => {
      // Organization
      const orgPatch = await ownerApp.fetch(
        patch(`/api/v1/organization/${organization.id}/settings`, [
          { key: 'general.defaultTimezone', value: 'America/Chicago' },
        ]),
      );
      expect(orgPatch.status).toBe(200);
      expect(
        (
          await parseSuccessBody<Setting[]>(
            await ownerApp.fetch(get(`/api/v1/organization/${organization.id}/settings`)),
          )
        ).data[0]?.valueText,
      ).toBe('America/Chicago');

      // OrganizationUser
      const orgUserPatch = await ownerApp.fetch(
        patch(`/api/v1/organizationUser/${ownerMember.id}/settings`, [
          { key: 'general.displayLocale', value: 'fr' },
        ]),
      );
      expect(orgUserPatch.status).toBe(200);
      const { data: orgUserRows } = await parseSuccessBody<Setting[]>(orgUserPatch);
      expect(orgUserRows[0]?.resourceId).toBe(ownerMember.id);
      const memberAudit = await ownerApp.db.auditLog.findMany({
        where: {
          subjectModel: AuditSubjectModel.Setting,
          subjectSettingId: orgUserRows[0]?.id ?? '',
        },
      });
      expect(memberAudit[0]?.contextOrganizationId).toBe(organization.id);

      // Space
      const spacePatch = await ownerApp.fetch(
        patch(`/api/v1/space/${space.id}/settings`, [
          { key: 'general.defaultTimezone', value: 'Europe/Berlin' },
        ]),
      );
      expect(spacePatch.status).toBe(200);

      // SpaceUser
      const spaceUserPatch = await ownerApp.fetch(
        patch(`/api/v1/spaceUser/${ownerSpaceMember.id}/settings`, [
          { key: 'general.displayLocale', value: 'de' },
        ]),
      );
      expect(spaceUserPatch.status).toBe(200);

      // Project
      const projectPatch = await ownerApp.fetch(
        patch(`/api/v1/project/${orgProject.id}/settings`, [
          { key: 'general.defaultTimezone', value: 'Asia/Tokyo' },
        ]),
      );
      expect(projectPatch.status).toBe(200);

      // Integration & ProjectIntegration (0 starter definitions -> 200 [] for authorized readers, 403 for outsiders)
      const intRead = await ownerApp.fetch(
        get(`/api/v1/integration/${orgIntegration.id}/settings`),
      );
      expect(intRead.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(intRead)).data).toEqual([]);

      const piRead = await ownerApp.fetch(
        get(`/api/v1/projectIntegration/${projectIntegration.id}/settings`),
      );
      expect(piRead.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(piRead)).data).toEqual([]);

      // Superadmin GET /api/admin/setting returns raw Setting rows
      const superadminApp = appFor(owner, [ownerMember], [ownerSpaceMember], { superadmin: true });
      const adminList = await superadminApp.fetch(get('/api/admin/setting'));
      expect(adminList.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(adminList)).data.length).toBeGreaterThanOrEqual(5);
    });

    it('rejects empty batch [], duplicate keys in batch, invalid keys, invalid values, and disallowed resourceModel with 422', async () => {
      // Empty batch
      expect((await ownerApp.fetch(patch('/api/v1/me/settings', []))).status).toBe(422);

      // Duplicate keys in same batch
      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/me/settings', [
              { key: 'general.defaultTimezone', value: 'UTC' },
              { key: 'general.defaultTimezone', value: 'America/New_York' },
            ]),
          )
        ).status,
      ).toBe(422);

      // Unknown key
      expect(
        (await ownerApp.fetch(patch('/api/v1/me/settings', [{ key: 'bogus.key', value: true }])))
          .status,
      ).toBe(422);

      // Invalid timezone
      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/me/settings', [{ key: 'general.defaultTimezone', value: 'Not/A_Zone' }]),
          )
        ).status,
      ).toBe(422);

      // Disallowed resourceModel (displayLocale is not on Project)
      expect(
        (
          await ownerApp.fetch(
            patch(`/api/v1/project/${orgProject.id}/settings`, [
              { key: 'general.displayLocale', value: 'en' },
            ]),
          )
        ).status,
      ).toBe(422);
    });
  });

  describe('ReBAC enforcement on parent-scoped GET and batch PATCH', () => {
    const memberOf = async (role: Role) => {
      const created = await createOrganizationUser({ role }, { organization });
      return {
        ...created,
        app: appFor(created.context.user, [created.entity]),
      };
    };

    it('outsiders get 403 on all tenant, project, integration, and projectIntegration GET & PATCH routes', async () => {
      const { entity: outsider } = await createUser();
      const outsiderApp = appFor(outsider, []);

      expect(
        (await outsiderApp.fetch(get(`/api/v1/organization/${organization.id}/settings`))).status,
      ).toBe(403);
      expect(
        (await outsiderApp.fetch(get(`/api/v1/organizationUser/${ownerMember.id}/settings`)))
          .status,
      ).toBe(403);
      expect((await outsiderApp.fetch(get(`/api/v1/space/${space.id}/settings`))).status).toBe(403);
      expect(
        (await outsiderApp.fetch(get(`/api/v1/project/${orgProject.id}/settings`))).status,
      ).toBe(403);
      expect(
        (await outsiderApp.fetch(get(`/api/v1/integration/${orgIntegration.id}/settings`))).status,
      ).toBe(403);
      expect(
        (
          await outsiderApp.fetch(
            get(`/api/v1/projectIntegration/${projectIntegration.id}/settings`),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await outsiderApp.fetch(
            patch(`/api/v1/organization/${organization.id}/settings`, [
              { key: 'general.defaultTimezone', value: 'UTC' },
            ]),
          )
        ).status,
      ).toBe(403);
    });

    it('org member reads org settings (200) but gets 403 on manage-gated PATCH; org admin writes (200)', async () => {
      const member = await memberOf(Role.member);
      const admin = await memberOf(Role.admin);

      expect(
        (await member.app.fetch(get(`/api/v1/organization/${organization.id}/settings`))).status,
      ).toBe(200);
      expect(
        (
          await member.app.fetch(
            patch(`/api/v1/organization/${organization.id}/settings`, [
              { key: 'general.defaultTimezone', value: 'America/Chicago' },
            ]),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await admin.app.fetch(
            patch(`/api/v1/organization/${organization.id}/settings`, [
              { key: 'general.defaultTimezone', value: 'America/Chicago' },
            ]),
          )
        ).status,
      ).toBe(200);
    });

    it('member settings (general.displayLocale on OrganizationUser): member reads & writes, org admin/owner/viewer get 200 [] on list (zero leak) and 403 on single read/PATCH/DELETE', async () => {
      const member = await memberOf(Role.member);
      const admin = await memberOf(Role.admin);
      const viewer = await memberOf(Role.viewer);

      const writeOwn = await member.app.fetch(
        patch(`/api/v1/organizationUser/${member.entity.id}/settings`, [
          { key: 'general.displayLocale', value: 'es' },
        ]),
      );
      expect(writeOwn.status).toBe(200);
      const { data: saved } = await parseSuccessBody<Setting[]>(writeOwn);
      const settingId = saved[0]?.id ?? '';

      // Member sees their own setting
      const ownList = await member.app.fetch(
        get(`/api/v1/organizationUser/${member.entity.id}/settings`),
      );
      expect(ownList.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(ownList)).data.map((r) => r.id)).toEqual([
        settingId,
      ]);

      // Admin, owner, viewer can read the OrganizationUser row (so parent read passes -> 200 []),
      // but per-key db:setting:read filters out private member preferences (zero leak), and
      // single read / PATCH / DELETE all return 403!
      for (const otherApp of [admin.app, ownerApp, viewer.app]) {
        const listRes = await otherApp.fetch(
          get(`/api/v1/organizationUser/${member.entity.id}/settings`),
        );
        expect(listRes.status).toBe(200);
        expect((await parseSuccessBody<Setting[]>(listRes)).data).toEqual([]);

        expect((await otherApp.fetch(get(`/api/v1/setting/${settingId}`))).status).toBe(403);
        expect(
          (
            await otherApp.fetch(
              patch(`/api/v1/organizationUser/${member.entity.id}/settings`, [
                { key: 'general.displayLocale', value: 'fr' },
              ]),
            )
          ).status,
        ).toBe(403);
        expect((await otherApp.fetch(del(`/api/v1/setting/${settingId}`))).status).toBe(403);
      }

      // Member resets own preference cleanly
      expect((await member.app.fetch(del(`/api/v1/setting/${settingId}`))).status).toBe(204);
    });
  });

  describe('Redis caching via fetchThroughCache and cacheKeysByModel.Setting', () => {
    it('populates Redis on first GET, serves second GET from cache, and invalidates on PATCH and DELETE', async () => {
      const key = cacheKey('setting', {
        resourceModel: SettingResourceModel.Organization,
        resourceId: organization.id,
      });

      // Seed one stored row first (clearCache hook leaves key empty)
      const seedRes = await ownerApp.fetch(
        patch(`/api/v1/organization/${organization.id}/settings`, [
          { key: 'general.defaultTimezone', value: 'America/New_York' },
        ]),
      );
      expect(seedRes.status).toBe(200);
      const { data: seeded } = await parseSuccessBody<Setting[]>(seedRes);
      const settingId = seeded[0]?.id ?? '';
      expect((await checkCache(key)).state).toBe('empty');

      // First GET populates Redis cache
      const firstGet = await ownerApp.fetch(
        get(`/api/v1/organization/${organization.id}/settings`),
      );
      expect(firstGet.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(firstGet)).data[0]?.valueText).toBe(
        'America/New_York',
      );
      const cached = await checkCache<Setting[]>(key);
      expect(cached.state).toBe('fresh');
      if (cached.state === 'fresh') {
        expect(cached.value[0]?.valueText).toBe('America/New_York');
        expect(cached.value[0]?.createdAt).toBeInstanceOf(Date);
      }

      // Second GET serves from Redis without querying Postgres
      const findManySpy = spyOn(ownerApp.db.setting, 'findMany');
      try {
        const secondGet = await ownerApp.fetch(
          get(`/api/v1/organization/${organization.id}/settings`),
        );
        expect(secondGet.status).toBe(200);
        expect((await parseSuccessBody<Setting[]>(secondGet)).data[0]?.valueText).toBe(
          'America/New_York',
        );
        expect(findManySpy).not.toHaveBeenCalled();
      } finally {
        findManySpy.mockRestore();
      }

      // PATCH automatically invalidates cache via clearCache hook; next GET sees updated value
      const updateRes = await ownerApp.fetch(
        patch(`/api/v1/organization/${organization.id}/settings`, [
          { key: 'general.defaultTimezone', value: 'Europe/Paris' },
        ]),
      );
      expect(updateRes.status).toBe(200);
      expect((await checkCache(key)).state).toBe('empty');

      const afterPatchGet = await ownerApp.fetch(
        get(`/api/v1/organization/${organization.id}/settings`),
      );
      expect(afterPatchGet.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(afterPatchGet)).data[0]?.valueText).toBe(
        'Europe/Paris',
      );
      expect((await checkCache(key)).state).toBe('fresh');

      // DELETE automatically invalidates cache via clearCache hook; next GET returns []
      expect((await ownerApp.fetch(del(`/api/v1/setting/${settingId}`))).status).toBe(204);
      expect((await checkCache(key)).state).toBe('empty');

      const afterDeleteGet = await ownerApp.fetch(
        get(`/api/v1/organization/${organization.id}/settings`),
      );
      expect(afterDeleteGet.status).toBe(200);
      expect((await parseSuccessBody<Setting[]>(afterDeleteGet)).data).toEqual([]);
    });
  });
});
