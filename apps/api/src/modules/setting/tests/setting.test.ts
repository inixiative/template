import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type {
  Organization,
  OrganizationUser,
  Project,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import { AuditAction, AuditSubjectModel, Role } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createProject,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { settingRouter } from '#/modules/setting';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch } from '#tests/utils/request';

const appFor = (user: User, organizationUsers: OrganizationUser[], spaceUsers: SpaceUser[] = []) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [(app) => app.route('/api/v1/setting', settingRouter)],
  });

type EffectiveSetting = {
  key: string;
  category: string;
  valueType: string;
  defaultValue: unknown;
  value: unknown;
  storedValue: unknown;
  disabled: boolean;
  isDefault: boolean;
  settingId: string | null;
};

type SettingRowResponse = {
  id: string;
  resourceModel: string;
  resourceId: string;
  key: string;
  disabled: boolean;
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueJson: unknown;
  value: unknown;
  storedValue: unknown;
};

describe('Setting API module', () => {
  let owner: User;
  let organization: Organization;
  let ownerMember: OrganizationUser;
  let space: Space;
  let ownerSpaceMember: SpaceUser;
  let orgProject: Project;
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
    ownerApp = appFor(owner, [ownerMember], [ownerSpaceMember]);
  });

  afterEach(async () => {
    await cleanupTouchedTables(ownerApp.db);
  });

  describe('GET /api/v1/setting/info', () => {
    it('returns guide, categories, and definitions covering all 6 attribute valueTypes with JSON Schemas (including date-time)', async () => {
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
              permission: string;
              readPermission: string;
            }
          >;
        };
      }>(response);

      expect(Object.keys(data.guide).length).toBeGreaterThan(0);
      expect(data.types.categories.general?.key).toBe('general');
      expect(data.types.categories.membership?.key).toBe('membership');
      expect(data.types.categories.notifications?.key).toBe('notifications');
      expect(data.types.categories.security?.key).toBe('security');

      expect(data.types.definitions['general.defaultTimezone']?.valueType).toBe('text');
      expect(data.types.definitions['member.autoAcceptInquiries']?.valueType).toBe('boolean');
      expect(data.types.definitions['member.maxActiveTasks']?.valueType).toBe('number');
      expect(data.types.definitions['notifications.topics']?.valueType).toBe('multiSelect');
      expect(data.types.definitions['notifications.quietHours']?.valueType).toBe('json');
      expect(data.types.definitions['notifications.snoozeUntil']?.valueType).toBe('date');
      expect(data.types.definitions['notifications.snoozeUntil']?.schema).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
      expect(data.types.definitions['notifications.quietHours']?.schema).toMatchObject({
        type: 'object',
      });
      expect(data.types.definitions['security.requireSso']).toMatchObject({
        permission: 'own',
        readPermission: 'manage',
      });
    });
  });

  describe('CRUD, defaults merge, typed values, disable, reset-to-default, and AuditLog', () => {
    it('merges defaults with stored rows, upserts every attribute valueType (including date), disables, and resets on DELETE', async () => {
      const initial = await ownerApp.fetch(
        get(`/api/v1/setting?resourceModel=Project&resourceProjectId=${orgProject.id}`),
      );
      expect(initial.status).toBe(200);
      const { data: initialList } = await parseSuccessBody<EffectiveSetting[]>(initial);
      const tzDefault = initialList.find((item) => item.key === 'general.defaultTimezone');
      expect(tzDefault).toMatchObject({
        value: 'UTC',
        defaultValue: 'UTC',
        storedValue: null,
        isDefault: true,
        settingId: null,
      });

      // Upsert text setting on Project
      const upsertTz = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Project',
          resourceProjectId: orgProject.id,
          key: 'general.defaultTimezone',
          value: 'America/New_York',
        }),
      );
      expect(upsertTz.status).toBe(200);
      const { data: savedTz } = await parseSuccessBody<SettingRowResponse>(upsertTz);
      expect(savedTz).toMatchObject({
        resourceModel: 'Project',
        resourceId: orgProject.id,
        key: 'general.defaultTimezone',
        valueText: 'America/New_York',
        valueBoolean: null,
        valueNumber: null,
        valueDate: null,
        valueJson: null,
        value: 'America/New_York',
        disabled: false,
      });

      // Upsert multiSelect setting with duplicate & unsorted entries -> canonically sorted & deduplicated in valueJson
      const upsertTopics = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Project',
          resourceProjectId: orgProject.id,
          key: 'notifications.topics',
          value: ['security', 'billing', 'security'],
        }),
      );
      expect(upsertTopics.status).toBe(200);
      const { data: savedTopics } = await parseSuccessBody<SettingRowResponse>(upsertTopics);
      expect(savedTopics.valueJson).toEqual(['billing', 'security']);
      expect(savedTopics.value).toEqual(['billing', 'security']);

      // Upsert JSON object setting
      const upsertQuiet = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Project',
          resourceProjectId: orgProject.id,
          key: 'notifications.quietHours',
          value: { enabled: true, startHour: 21, endHour: 7 },
        }),
      );
      expect(upsertQuiet.status).toBe(200);
      const { data: savedQuiet } = await parseSuccessBody<SettingRowResponse>(upsertQuiet);
      expect(savedQuiet.value).toEqual({ enabled: true, startHour: 21, endHour: 7 });

      // Upsert Date setting (ISO string stored in valueDate)
      const snoozeIso = '2026-12-31T23:59:00.000Z';
      const upsertDate = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Project',
          resourceProjectId: orgProject.id,
          key: 'notifications.snoozeUntil',
          value: snoozeIso,
        }),
      );
      expect(upsertDate.status).toBe(200);
      const { data: savedDate } = await parseSuccessBody<SettingRowResponse>(upsertDate);
      expect(savedDate.valueDate).toBe(snoozeIso);
      expect(savedDate.value).toBe(snoozeIso);
      expect(savedDate.valueText).toBeNull();

      // Update existing setting in place (atomic upsert — same row ID!) and disable it
      const disabledTz = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Project',
          resourceProjectId: orgProject.id,
          key: 'general.defaultTimezone',
          value: 'Europe/London',
          disabled: true,
        }),
      );
      expect(disabledTz.status).toBe(200);
      const { data: updatedTz } = await parseSuccessBody<SettingRowResponse>(disabledTz);
      expect(updatedTz.id).toBe(savedTz.id);
      expect(updatedTz.disabled).toBe(true);
      expect(updatedTz.storedValue).toBe('Europe/London');
      expect(updatedTz.value).toBe('UTC');

      // Filter list by category
      const notifOnly = await ownerApp.fetch(
        get(
          `/api/v1/setting?resourceModel=Project&resourceProjectId=${orgProject.id}&category=notifications`,
        ),
      );
      expect(notifOnly.status).toBe(200);
      const { data: notifItems } = await parseSuccessBody<EffectiveSetting[]>(notifOnly);
      expect(notifItems.map((i) => i.key)).toEqual([
        'notifications.topics',
        'notifications.quietHours',
        'notifications.snoozeUntil',
        'notifications.digestPaused',
      ]);
      expect(notifItems[0]).toMatchObject({
        value: ['billing', 'security'],
        isDefault: false,
        settingId: savedTopics.id,
      });
      expect(notifItems[2]).toMatchObject({
        value: snoozeIso,
        isDefault: false,
        settingId: savedDate.id,
      });

      // Read single stored setting by ID
      const readSingle = await ownerApp.fetch(get(`/api/v1/setting/${savedTopics.id}`));
      expect(readSingle.status).toBe(200);
      const { data: singleData } = await parseSuccessBody<SettingRowResponse>(readSingle);
      expect(singleData.value).toEqual(['billing', 'security']);

      // Immutable key guard refuses mutating key after create via DB hook
      await expect(
        ownerApp.db.setting.update({
          where: { id: savedTz.id },
          data: { key: 'notifications.topics' },
        }),
      ).rejects.toThrow(/cannot change after create/);

      // Soft-delete resets setting to default
      const deleted = await ownerApp.fetch(del(`/api/v1/setting/${savedTz.id}`));
      expect(deleted.status).toBe(204);
      expect((await ownerApp.fetch(get(`/api/v1/setting/${savedTz.id}`))).status).toBe(404);

      // Re-creating after soft-delete succeeds with a fresh row
      const recreated = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Project',
          resourceProjectId: orgProject.id,
          key: 'general.defaultTimezone',
          value: 'Asia/Tokyo',
        }),
      );
      expect(recreated.status).toBe(200);
      const { data: freshTz } = await parseSuccessBody<SettingRowResponse>(recreated);
      expect(freshTz.id).not.toBe(savedTz.id);
      expect(freshTz.value).toBe('Asia/Tokyo');

      // AuditLog automatically recorded create, update, and delete with parent tenancy context
      const auditLogs = await ownerApp.db.auditLog.findMany({
        where: { subjectModel: AuditSubjectModel.Setting, subjectSettingId: savedTz.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(auditLogs.map((log) => log.action)).toEqual([
        AuditAction.create,
        AuditAction.update,
        AuditAction.delete,
      ]);
      expect(auditLogs[0]?.contextOrganizationId).toBe(organization.id);
    });

    it('supports OrganizationUser boolean + number settings with composite FK targeting and AuditLog tenancy', async () => {
      const setBool = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'OrganizationUser',
          resourceOrganizationId: organization.id,
          resourceUserId: owner.id,
          key: 'member.autoAcceptInquiries',
          value: true,
        }),
      );
      expect(setBool.status).toBe(200);
      const { data: boolRow } = await parseSuccessBody<SettingRowResponse>(setBool);
      expect(boolRow.resourceId).toBe(ownerMember.id);
      expect(boolRow.valueBoolean).toBe(true);
      expect(boolRow.value).toBe(true);

      const memberAuditLogs = await ownerApp.db.auditLog.findMany({
        where: { subjectModel: AuditSubjectModel.Setting, subjectSettingId: boolRow.id },
      });
      expect(memberAuditLogs).toHaveLength(1);
      expect(memberAuditLogs[0]?.contextOrganizationId).toBe(organization.id);

      const setNum = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'OrganizationUser',
          resourceOrganizationId: organization.id,
          resourceUserId: owner.id,
          key: 'member.maxActiveTasks',
          value: 25,
        }),
      );
      expect(setNum.status).toBe(200);
      const { data: numRow } = await parseSuccessBody<SettingRowResponse>(setNum);
      expect(numRow.valueNumber).toBe(25);
      expect(numRow.value).toBe(25);
    });

    it('rejects invalid key, wrong value type, invalid/non-ISO date, out-of-range value, disallowed resourceModel, and mismatched FKs with 422', async () => {
      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'User',
              resourceUserId: owner.id,
              key: 'bogus.key',
              value: true,
            }),
          )
        ).status,
      ).toBe(422);

      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'Organization',
              resourceOrganizationId: organization.id,
              key: 'member.autoAcceptInquiries',
              value: true,
            }),
          )
        ).status,
      ).toBe(422);

      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'User',
              resourceUserId: owner.id,
              key: 'notifications.snoozeUntil',
              value: 'not-a-valid-date',
            }),
          )
        ).status,
      ).toBe(422);

      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'User',
              resourceUserId: owner.id,
              key: 'notifications.snoozeUntil',
              value: 'Dec 1, 2026',
            }),
          )
        ).status,
      ).toBe(422);

      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'OrganizationUser',
              resourceOrganizationId: organization.id,
              resourceUserId: owner.id,
              key: 'member.maxActiveTasks',
              value: 500,
            }),
          )
        ).status,
      ).toBe(422);

      expect(
        (
          await ownerApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'Organization',
              resourceOrganizationId: organization.id,
              resourceUserId: owner.id,
              key: 'general.defaultTimezone',
              value: 'UTC',
            }),
          )
        ).status,
      ).toBe(422);
    });
  });

  describe('ReBAC enforcement via settingResourcePermission (manage + read)', () => {
    const memberOf = async (role: Role) => {
      const created = await createOrganizationUser({ role }, { organization });
      return {
        ...created,
        app: appFor(created.context.user, [created.entity]),
      };
    };

    it('enforces own-gated setting with restricted readPermission (security.requireSso): owner writes/deletes, admin reads only, member hidden & 403', async () => {
      const admin = await memberOf(Role.admin);
      const member = await memberOf(Role.member);

      // Admin cannot PATCH an own-gated setting
      expect(
        (
          await admin.app.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'Organization',
              resourceOrganizationId: organization.id,
              key: 'security.requireSso',
              value: true,
            }),
          )
        ).status,
      ).toBe(403);

      // Owner can PATCH it
      const created = await ownerApp.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Organization',
          resourceOrganizationId: organization.id,
          key: 'security.requireSso',
          value: true,
        }),
      );
      expect(created.status).toBe(200);
      const { data: ssoRow } = await parseSuccessBody<SettingRowResponse>(created);

      // Admin sees security.requireSso in list and single read, but gets 403 on DELETE
      const adminList = await admin.app.fetch(
        get(`/api/v1/setting?resourceModel=Organization&resourceOrganizationId=${organization.id}`),
      );
      expect(adminList.status).toBe(200);
      const { data: adminItems } = await parseSuccessBody<EffectiveSetting[]>(adminList);
      expect(adminItems.some((item) => item.key === 'security.requireSso')).toBe(true);
      expect((await admin.app.fetch(get(`/api/v1/setting/${ssoRow.id}`))).status).toBe(200);
      expect((await admin.app.fetch(del(`/api/v1/setting/${ssoRow.id}`))).status).toBe(403);

      // Member does NOT see security.requireSso in org list and gets 403 on single key / single ID / DELETE
      const memberList = await member.app.fetch(
        get(`/api/v1/setting?resourceModel=Organization&resourceOrganizationId=${organization.id}`),
      );
      expect(memberList.status).toBe(200);
      const { data: memberItems } = await parseSuccessBody<EffectiveSetting[]>(memberList);
      expect(memberItems.some((item) => item.key === 'security.requireSso')).toBe(false);
      expect(
        (
          await member.app.fetch(
            get(
              `/api/v1/setting?resourceModel=Organization&resourceOrganizationId=${organization.id}&key=security.requireSso`,
            ),
          )
        ).status,
      ).toBe(403);
      expect((await member.app.fetch(get(`/api/v1/setting/${ssoRow.id}`))).status).toBe(403);
      expect((await member.app.fetch(del(`/api/v1/setting/${ssoRow.id}`))).status).toBe(403);

      // Owner deletes cleanly
      expect((await ownerApp.fetch(del(`/api/v1/setting/${ssoRow.id}`))).status).toBe(204);
    });

    it('enforces operate-gated setting (notifications.digestPaused): member writes & deletes, viewer reads only', async () => {
      const member = await memberOf(Role.member);
      const viewer = await memberOf(Role.viewer);

      // Viewer cannot write
      expect(
        (
          await viewer.app.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'Organization',
              resourceOrganizationId: organization.id,
              key: 'notifications.digestPaused',
              value: true,
            }),
          )
        ).status,
      ).toBe(403);

      // Member can write
      const memberWrite = await member.app.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'Organization',
          resourceOrganizationId: organization.id,
          key: 'notifications.digestPaused',
          value: true,
        }),
      );
      expect(memberWrite.status).toBe(200);
      const { data: digestRow } = await parseSuccessBody<SettingRowResponse>(memberWrite);

      // Viewer can read, cannot delete
      expect((await viewer.app.fetch(get(`/api/v1/setting/${digestRow.id}`))).status).toBe(200);
      expect((await viewer.app.fetch(del(`/api/v1/setting/${digestRow.id}`))).status).toBe(403);

      // Member can delete (same `manage` action as PATCH!)
      expect((await member.app.fetch(del(`/api/v1/setting/${digestRow.id}`))).status).toBe(204);
    });

    it('allows org admin to write manage-gated settings while denying org member (403)', async () => {
      const member = await memberOf(Role.member);
      const admin = await memberOf(Role.admin);

      expect(
        (
          await member.app.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'Organization',
              resourceOrganizationId: organization.id,
              key: 'general.defaultTimezone',
              value: 'America/Chicago',
            }),
          )
        ).status,
      ).toBe(403);

      expect(
        (
          await admin.app.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'Organization',
              resourceOrganizationId: organization.id,
              key: 'general.defaultTimezone',
              value: 'America/Chicago',
            }),
          )
        ).status,
      ).toBe(200);
    });

    it('protects personal member settings (member.autoAcceptInquiries): private to the member themselves; admin and owner get 403', async () => {
      const member = await memberOf(Role.member);
      const admin = await memberOf(Role.admin);

      const writeOwn = await member.app.fetch(
        patch('/api/v1/setting', {
          resourceModel: 'OrganizationUser',
          resourceOrganizationId: organization.id,
          resourceUserId: member.context.user.id,
          key: 'member.autoAcceptInquiries',
          value: true,
        }),
      );
      expect(writeOwn.status).toBe(200);
      const { data: memberSetting } = await parseSuccessBody<SettingRowResponse>(writeOwn);

      for (const otherApp of [admin.app, ownerApp]) {
        expect(
          (
            await otherApp.fetch(
              get(
                `/api/v1/setting?resourceModel=OrganizationUser&resourceOrganizationId=${organization.id}&resourceUserId=${member.context.user.id}&key=member.autoAcceptInquiries`,
              ),
            )
          ).status,
        ).toBe(403);
        expect((await otherApp.fetch(get(`/api/v1/setting/${memberSetting.id}`))).status).toBe(403);
        expect(
          (
            await otherApp.fetch(
              patch('/api/v1/setting', {
                resourceModel: 'OrganizationUser',
                resourceOrganizationId: organization.id,
                resourceUserId: member.context.user.id,
                key: 'member.autoAcceptInquiries',
                value: false,
              }),
            )
          ).status,
        ).toBe(403);
        expect((await otherApp.fetch(del(`/api/v1/setting/${memberSetting.id}`))).status).toBe(403);
      }

      // Member reads and resets their own preference cleanly
      expect((await member.app.fetch(get(`/api/v1/setting/${memberSetting.id}`))).status).toBe(200);
      expect((await member.app.fetch(del(`/api/v1/setting/${memberSetting.id}`))).status).toBe(204);
    });

    it('blocks another user from reading or writing personal settings (403)', async () => {
      const { entity: outsider } = await createUser();
      const outsiderApp = appFor(outsider, []);

      expect(
        (
          await outsiderApp.fetch(
            get(`/api/v1/setting?resourceModel=User&resourceUserId=${owner.id}`),
          )
        ).status,
      ).toBe(403);

      expect(
        (
          await outsiderApp.fetch(
            patch('/api/v1/setting', {
              resourceModel: 'User',
              resourceUserId: owner.id,
              key: 'general.defaultTimezone',
              value: 'Europe/Paris',
            }),
          )
        ).status,
      ).toBe(403);
    });
  });
});
