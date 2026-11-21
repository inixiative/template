import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  attributeOrderBy,
  attributeWhereEquals,
  attributeWhereIn,
  attributeWhereMultiSelectContains,
  attributeWhereMultiSelectContainsAll,
  attributeWhereMultiSelectContainsAny,
  attributeWhereRange,
  buildAttributeUpsertData,
  decodeAttributeValue,
  decodeStoredAttributeValue,
  encodeAttributeColumns,
  packAttributeValue,
  resolveEffectiveAttributeValues,
  unpackAttributeValue,
  validateAttributeWrite,
} from '@template/db/lib/attributes';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createProject,
  createSetting,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';

describe('Attribute model capability (5-column codec, operators, utils, Postgres indexes)', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  describe('codec, pack/unpack, and write validation', () => {
    it('packs and unpacks all 6 valueTypes with sibling columns explicitly nulled', () => {
      const multi = encodeAttributeColumns('setting', 'notifications.topics', [
        'billing',
        'security',
        'billing',
      ]);
      expect(multi.valueBoolean).toBeNull();
      expect(multi.valueText).toBeNull();
      expect(multi.valueNumber).toBeNull();
      expect(multi.valueDate).toBeNull();
      expect(multi.valueJson).toEqual(['billing', 'security']);
      expect(unpackAttributeValue(multi, 'multiSelect')).toEqual(['billing', 'security']);

      const dateIso = '2026-12-15T18:30:00.000Z';
      const packedDate = packAttributeValue('date', dateIso);
      expect(packedDate.valueDate).toBeInstanceOf(Date);
      expect(packedDate.valueDate?.toISOString()).toBe(dateIso);
      expect((unpackAttributeValue(packedDate) as Date).toISOString()).toBe(dateIso);
    });

    it('rejects unknown locators, invalid schemas, mixed columns, and disallowed resourceModels', () => {
      expect(() => encodeAttributeColumns('setting', 'unknown.key', true)).toThrow(
        'Unknown attribute locator',
      );
      expect(() =>
        encodeAttributeColumns('setting', 'general.defaultTimezone', 'Not/A_Zone'),
      ).toThrow('Invalid value');

      const disallowed = validateAttributeWrite('setting', {
        resourceModel: 'Project',
        key: 'member.autoAcceptInquiries',
        valueBoolean: true,
      });
      expect(disallowed.ok).toBe(false);

      const mixed = validateAttributeWrite('setting', {
        resourceModel: 'User',
        key: 'general.defaultTimezone',
        valueText: 'UTC',
        valueDate: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(mixed.ok).toBe(false);
    });

    it('decodes stored values and falls back to defaultValue when disabled', async () => {
      const { entity: member, context } = await createOrganizationUser();
      const { entity: setting } = await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: member.id,
        resourceOrganizationId: context.organization.id,
        resourceUserId: context.user.id,
        key: 'member.maxActiveTasks',
        disabled: true,
        ...buildAttributeUpsertData('setting', 'member.maxActiveTasks', 42),
      });

      expect(decodeStoredAttributeValue('setting', setting)).toBe(42);
      expect(decodeAttributeValue('setting', setting)).toBe(10); // defaultValue when disabled

      const effective = resolveEffectiveAttributeValues('setting', 'OrganizationUser', [setting]);
      const entry = effective.items.find((item) => item.key === 'member.maxActiveTasks');
      expect(entry).toMatchObject({
        value: 10,
        storedValue: 42,
        disabled: true,
        isDefault: true,
        settingId: setting.id,
      });
      expect(effective.byCategory.membership?.some((i) => i.key === 'member.maxActiveTasks')).toBe(
        true,
      );
    });
  });

  describe('typed Attribute operators against live Postgres (number, date, and GIN array_contains)', () => {
    it('queries numbers, dates, ranges, ordering, and multiSelect array_contains via GIN', async () => {
      const { entity: org } = await createOrganization();
      const { entity: memberA, context: ctxA } = await createOrganizationUser(
        {},
        { organization: org },
      );
      const { entity: memberB, context: ctxB } = await createOrganizationUser(
        {},
        { organization: org },
      );
      const { entity: memberC, context: ctxC } = await createOrganizationUser(
        {},
        { organization: org },
      );

      // Numeric Float? values
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: memberA.id,
        resourceOrganizationId: org.id,
        resourceUserId: ctxA.user.id,
        key: 'member.maxActiveTasks',
        ...encodeAttributeColumns('setting', 'member.maxActiveTasks', 5),
      });
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: memberB.id,
        resourceOrganizationId: org.id,
        resourceUserId: ctxB.user.id,
        key: 'member.maxActiveTasks',
        ...encodeAttributeColumns('setting', 'member.maxActiveTasks', 25),
      });
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: memberC.id,
        resourceOrganizationId: org.id,
        resourceUserId: ctxC.user.id,
        key: 'member.maxActiveTasks',
        ...encodeAttributeColumns('setting', 'member.maxActiveTasks', 80),
      });

      const inRange = await db.setting.findMany({
        where: attributeWhereRange('setting', 'member.maxActiveTasks', { gte: 10, lte: 90 }),
        orderBy: attributeOrderBy('setting', 'member.maxActiveTasks', 'desc'),
      });
      expect(inRange.map((row) => decodeStoredAttributeValue('setting', row))).toEqual([80, 25]);

      const exact = await db.setting.findMany({
        where: attributeWhereEquals('setting', 'member.maxActiveTasks', 25),
      });
      expect(exact).toHaveLength(1);
      expect(exact[0]?.resourceId).toBe(memberB.id);

      const inSet = await db.setting.findMany({
        where: attributeWhereIn('setting', 'member.maxActiveTasks', [5, 80]),
        orderBy: attributeOrderBy('setting', 'member.maxActiveTasks', 'asc'),
      });
      expect(inSet.map((row) => row.resourceId)).toEqual([memberA.id, memberC.id]);

      // DateTime? values + date range + date equals + date in + date orderBy
      const d1 = new Date('2026-12-01T00:00:00.000Z');
      const d2 = new Date('2026-12-10T00:00:00.000Z');
      const d3 = new Date('2026-12-20T00:00:00.000Z');

      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxA.user.id,
        key: 'notifications.snoozeUntil',
        ...encodeAttributeColumns('setting', 'notifications.snoozeUntil', d1),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxB.user.id,
        key: 'notifications.snoozeUntil',
        ...encodeAttributeColumns('setting', 'notifications.snoozeUntil', d2),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxC.user.id,
        key: 'notifications.snoozeUntil',
        ...encodeAttributeColumns('setting', 'notifications.snoozeUntil', d3),
      });

      const datesInRange = await db.setting.findMany({
        where: attributeWhereRange('setting', 'notifications.snoozeUntil', {
          gte: '2026-12-05T00:00:00.000Z',
          lte: '2026-12-25T00:00:00.000Z',
        }),
        orderBy: attributeOrderBy('setting', 'notifications.snoozeUntil', 'asc'),
      });
      expect(datesInRange.map((row) => row.resourceUserId)).toEqual([ctxB.user.id, ctxC.user.id]);

      const exactDate = await db.setting.findMany({
        where: attributeWhereEquals('setting', 'notifications.snoozeUntil', d2.toISOString()),
      });
      expect(exactDate.map((row) => row.resourceUserId)).toEqual([ctxB.user.id]);

      const dateInSet = await db.setting.findMany({
        where: attributeWhereIn('setting', 'notifications.snoozeUntil', [d1, d3]),
        orderBy: attributeOrderBy('setting', 'notifications.snoozeUntil', 'desc'),
      });
      expect(dateInSet.map((row) => row.resourceUserId)).toEqual([ctxC.user.id, ctxA.user.id]);

      // Multi-select GIN array_contains (@>) queries
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxA.user.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['inquiries', 'security']),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxB.user.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['billing', 'security']),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxC.user.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['digest']),
      });

      const hasSecurity = await db.setting.findMany({
        where: attributeWhereMultiSelectContains('setting', 'notifications.topics', 'security'),
      });
      expect(new Set(hasSecurity.map((row) => row.resourceUserId))).toEqual(
        new Set([ctxA.user.id, ctxB.user.id]),
      );

      const hasBoth = await db.setting.findMany({
        where: attributeWhereMultiSelectContainsAll('setting', 'notifications.topics', [
          'inquiries',
          'security',
        ]),
      });
      expect(hasBoth.map((row) => row.resourceUserId)).toEqual([ctxA.user.id]);

      const hasEither = await db.setting.findMany({
        where: attributeWhereMultiSelectContainsAny('setting', 'notifications.topics', [
          'billing',
          'digest',
        ]),
      });
      expect(new Set(hasEither.map((row) => row.resourceUserId))).toEqual(
        new Set([ctxB.user.id, ctxC.user.id]),
      );
    });
  });

  describe('partial unique indexes across all 6 resourceModels', () => {
    it('isolates User, Organization, OrganizationUser, Space, SpaceUser, and Project keys without cross-arm collisions and frees keys on soft-delete', async () => {
      const { entity: member, context } = await createOrganizationUser();
      const { user, organization } = context;
      const { entity: space } = await createSpace({}, { organization });
      const { entity: spaceUser } = await createSpaceUser(
        {},
        { organization, user, organizationUser: member, space },
      );
      const { entity: project } = await createProject({
        ownerModel: 'Organization',
        organizationId: organization.id,
      });

      const userSetting = (
        await createSetting({
          resourceModel: 'User',
          resourceUserId: user.id,
          key: 'notifications.topics',
          ...encodeAttributeColumns('setting', 'notifications.topics', ['inquiries']),
        })
      ).entity;
      await createSetting({
        resourceModel: 'Organization',
        resourceOrganizationId: organization.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['security']),
      });
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: member.id,
        resourceOrganizationId: organization.id,
        resourceUserId: user.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['billing']),
      });
      await createSetting({
        resourceModel: 'Space',
        resourceOrganizationId: organization.id,
        resourceSpaceId: space.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['digest']),
      });
      await createSetting({
        resourceModel: 'SpaceUser',
        resourceId: spaceUser.id,
        resourceOrganizationId: organization.id,
        resourceSpaceId: space.id,
        resourceUserId: user.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['inquiries']),
      });
      await createSetting({
        resourceModel: 'Project',
        resourceProjectId: project.id,
        key: 'notifications.topics',
        ...encodeAttributeColumns('setting', 'notifications.topics', ['security']),
      });

      await expect(
        createSetting({
          resourceModel: 'User',
          resourceUserId: user.id,
          key: 'notifications.topics',
          ...encodeAttributeColumns('setting', 'notifications.topics', ['digest']),
        }),
      ).rejects.toThrow();

      await db.setting.update({
        where: { id: userSetting.id },
        data: { deletedAt: new Date() },
      });
      const recreated = (
        await createSetting({
          resourceModel: 'User',
          resourceUserId: user.id,
          key: 'notifications.topics',
          ...encodeAttributeColumns('setting', 'notifications.topics', ['digest']),
        })
      ).entity;
      expect(recreated.id).not.toBe(userSetting.id);
    });

    it('creates a distinct user setting row independently per user', async () => {
      const { entity: u1 } = await createUser();
      const { entity: u2 } = await createUser();
      await createSetting({
        resourceModel: 'User',
        resourceUserId: u1.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'America/New_York'),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: u2.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Europe/London'),
      });
      const count = await db.setting.count({ where: { key: 'general.defaultTimezone' } });
      expect(count).toBe(2);
    });
  });
});
