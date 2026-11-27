import { afterEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db, Prisma } from '@template/db';
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
  unpackAttributeValue,
  validateAttributeWrite,
} from '@template/db/lib/attributes';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
  createSetting,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { defineAttributeField } from '@template/shared/attributes';

const syntheticNumberDef = defineAttributeField({
  key: 'test.maxTasks',
  valueType: 'number',
  conditions: {
    all: [
      { field: 'value', operator: Operator.greaterThanEquals, value: 1, error: 'At least 1' },
      { field: 'value', operator: Operator.lessThanEquals, value: 100, error: 'At most 100' },
    ],
  },
  defaultValue: 10,
  label: 'Max Tasks',
  description: 'Synthetic number attribute for DB operator tests.',
});

const syntheticBoolDef = defineAttributeField({
  key: 'test.enabled',
  valueType: 'boolean',
  defaultValue: false,
  label: 'Enabled',
  description: 'Synthetic boolean attribute for DB tests.',
});

const syntheticDateDef = defineAttributeField({
  key: 'test.snoozeUntil',
  valueType: 'date',
  defaultValue: null,
  label: 'Snooze Until',
  description: 'Synthetic date attribute for DB operator tests.',
});

const syntheticJsonDef = defineAttributeField({
  key: 'test.quietHours',
  valueType: 'json',
  defaultValue: { enabled: false, startHour: 22 },
  label: 'Quiet Hours',
  description: 'Synthetic JSON attribute for DB tests.',
});

const syntheticMultiDef = defineAttributeField({
  key: 'test.topics',
  valueType: 'multiSelect',
  options: ['inquiries', 'security', 'billing', 'digest'].map((value) => ({ value, label: value })),
  defaultValue: ['inquiries', 'security'],
  label: 'Topics',
  description: 'Synthetic multiSelect attribute for Postgres GIN tests.',
});

describe('Attribute model capability (5-column codec, operators, Postgres GIN indexes)', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  describe('codec, pack/unpack, and write validation', () => {
    it('packs and unpacks all 6 valueTypes with sibling columns explicitly nulled and canonical sorted multiSelect', () => {
      const multi = encodeAttributeColumns(
        'setting',
        syntheticMultiDef.key,
        ['security', 'billing', 'security'],
        { definition: syntheticMultiDef },
      );
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

      // Accepts both accessor ('setting') and PascalCase ('Setting') uniformly
      expect(encodeAttributeColumns('Setting', 'general.defaultTimezone', 'UTC').valueText).toBe(
        'UTC',
      );
      expect(buildAttributeUpsertData('Setting', 'general.defaultTimezone', 'UTC').valueText).toBe(
        'UTC',
      );
    });

    it('rejects unknown locators, invalid schemas, mixed columns, and Prisma.JsonNull', () => {
      expect(() => encodeAttributeColumns('setting', 'unknown.key', true)).toThrow(
        'Unknown attribute locator',
      );
      expect(() =>
        encodeAttributeColumns('setting', 'general.defaultTimezone', 'Not/A_Zone'),
      ).toThrow('Invalid value');

      expect(() =>
        validateAttributeWrite('setting', {
          resourceModel: 'User',
          key: 'general.defaultTimezone',
          valueText: 'UTC',
          valueDate: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ).toThrow(/must be null/);

      expect(() =>
        validateAttributeWrite('setting', {
          resourceModel: 'User',
          key: 'general.defaultTimezone',
          valueText: 'UTC',
          valueJson: Prisma.JsonNull,
        }),
      ).toThrow(/Prisma\.JsonNull/);

      expect(() =>
        validateAttributeWrite(
          'setting',
          {
            resourceModel: 'User',
            key: syntheticJsonDef.key,
            valueJson: Prisma.JsonNull,
          },
          { resolveDefinition: () => syntheticJsonDef },
        ),
      ).toThrow(/Prisma\.JsonNull/);
    });

    it('preserves plain json string[] payloads verbatim while canonicalizing multiSelect arrays', () => {
      const jsonPacked = packAttributeValue('json', ['b', 'a', 'b']);
      expect(jsonPacked.valueJson).toEqual(['b', 'a', 'b']);
      expect(unpackAttributeValue(jsonPacked, 'json')).toEqual(['b', 'a', 'b']);

      const multiPacked = packAttributeValue('multiSelect', ['b', 'a', 'b']);
      expect(multiPacked.valueJson).toEqual(['a', 'b']);
      expect(unpackAttributeValue(multiPacked, 'multiSelect')).toEqual(['a', 'b']);

      const inspectedMulti = validateAttributeWrite(
        'setting',
        {
          resourceModel: 'User',
          key: syntheticMultiDef.key,
          valueJson: ['security', 'billing', 'security'],
        },
        { resolveDefinition: () => syntheticMultiDef },
      );
      expect(inspectedMulti.normalizedValueJson).toEqual(['billing', 'security']);
    });

    it('validates runtime operand types and finite numbers in attributeWhereEquals and attributeWhereIn', () => {
      expect(() =>
        attributeWhereEquals('Setting', syntheticNumberDef.key, Number.NaN, {
          definition: syntheticNumberDef,
        }),
      ).toThrow(/finite number/);
      expect(() =>
        attributeWhereEquals('setting', syntheticNumberDef.key, Number.POSITIVE_INFINITY, {
          definition: syntheticNumberDef,
        }),
      ).toThrow(/finite number/);
      expect(() =>
        attributeWhereEquals('setting', syntheticNumberDef.key, '25', {
          definition: syntheticNumberDef,
        }),
      ).toThrow(/finite number/);
      expect(() =>
        attributeWhereEquals('setting', syntheticBoolDef.key, 'true', {
          definition: syntheticBoolDef,
        }),
      ).toThrow(/boolean/);
      expect(() => attributeWhereEquals('setting', 'general.defaultTimezone', 123)).toThrow(
        /string/,
      );
      expect(() =>
        attributeWhereEquals('setting', syntheticJsonDef.key, null, {
          definition: syntheticJsonDef,
        }),
      ).toThrow(/non-null JSON/);
      expect(() =>
        attributeWhereEquals('setting', syntheticJsonDef.key, Prisma.JsonNull, {
          definition: syntheticJsonDef,
        }),
      ).toThrow(/non-null JSON/);

      expect(() =>
        attributeWhereIn('Setting', syntheticNumberDef.key, [10, Number.NaN], {
          definition: syntheticNumberDef,
        }),
      ).toThrow(/finite number/);
      expect(() =>
        attributeWhereIn('setting', 'general.defaultTimezone', ['UTC', 42 as unknown as string]),
      ).toThrow(/string/);
    });

    it('decodes stored values and falls back to defaultValue when disabled', async () => {
      const { entity: member, context } = await createOrganizationUser();
      const { entity: setting } = await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: member.id,
        resourceOrganizationId: context.organization.id,
        resourceUserId: context.user.id,
        key: syntheticNumberDef.key,
        disabled: true,
        ...buildAttributeUpsertData('setting', syntheticNumberDef.key, 42, {
          definition: syntheticNumberDef,
        }),
      });

      expect(
        decodeStoredAttributeValue('setting', setting, { definition: syntheticNumberDef }),
      ).toBe(42);
      expect(decodeAttributeValue('setting', setting, { definition: syntheticNumberDef })).toBe(10);
    });
  });

  describe('typed Attribute operators against live Postgres (number, date, and GIN array_contains)', () => {
    it('queries numbers, dates, ranges, ordering, canonical multiSelect equals, and GIN array_contains', async () => {
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
        key: syntheticNumberDef.key,
        ...encodeAttributeColumns('setting', syntheticNumberDef.key, 5, {
          definition: syntheticNumberDef,
        }),
      });
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: memberB.id,
        resourceOrganizationId: org.id,
        resourceUserId: ctxB.user.id,
        key: syntheticNumberDef.key,
        ...encodeAttributeColumns('setting', syntheticNumberDef.key, 25, {
          definition: syntheticNumberDef,
        }),
      });
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: memberC.id,
        resourceOrganizationId: org.id,
        resourceUserId: ctxC.user.id,
        key: syntheticNumberDef.key,
        ...encodeAttributeColumns('setting', syntheticNumberDef.key, 80, {
          definition: syntheticNumberDef,
        }),
      });

      const inRange = await db.setting.findMany({
        where: attributeWhereRange(
          'Setting',
          syntheticNumberDef.key,
          { gte: 10, lte: 90 },
          { definition: syntheticNumberDef },
        ),
        orderBy: attributeOrderBy('Setting', syntheticNumberDef.key, 'desc', {
          definition: syntheticNumberDef,
        }),
      });
      expect(
        inRange.map((row) =>
          decodeStoredAttributeValue('setting', row, { definition: syntheticNumberDef }),
        ),
      ).toEqual([80, 25]);

      const exact = await db.setting.findMany({
        where: attributeWhereEquals('setting', syntheticNumberDef.key, 25, {
          definition: syntheticNumberDef,
        }),
      });
      expect(exact).toHaveLength(1);
      expect(exact[0]?.resourceId).toBe(memberB.id);

      const inSet = await db.setting.findMany({
        where: attributeWhereIn('setting', syntheticNumberDef.key, [5, 80], {
          definition: syntheticNumberDef,
        }),
        orderBy: attributeOrderBy('setting', syntheticNumberDef.key, 'asc', {
          definition: syntheticNumberDef,
        }),
      });
      expect(inSet.map((row) => row.resourceId)).toEqual([memberA.id, memberC.id]);

      // DateTime? values + date range + date equals + date in + date orderBy
      const d1 = new Date('2026-12-01T00:00:00.000Z');
      const d2 = new Date('2026-12-10T00:00:00.000Z');
      const d3 = new Date('2026-12-20T00:00:00.000Z');

      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxA.user.id,
        key: syntheticDateDef.key,
        ...encodeAttributeColumns('setting', syntheticDateDef.key, d1, {
          definition: syntheticDateDef,
        }),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxB.user.id,
        key: syntheticDateDef.key,
        ...encodeAttributeColumns('setting', syntheticDateDef.key, d2, {
          definition: syntheticDateDef,
        }),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxC.user.id,
        key: syntheticDateDef.key,
        ...encodeAttributeColumns('setting', syntheticDateDef.key, d3, {
          definition: syntheticDateDef,
        }),
      });

      const datesInRange = await db.setting.findMany({
        where: attributeWhereRange(
          'setting',
          syntheticDateDef.key,
          { gte: '2026-12-05T00:00:00.000Z', lte: '2026-12-25T00:00:00.000Z' },
          { definition: syntheticDateDef },
        ),
        orderBy: attributeOrderBy('setting', syntheticDateDef.key, 'asc', {
          definition: syntheticDateDef,
        }),
      });
      expect(datesInRange.map((row) => row.resourceUserId)).toEqual([ctxB.user.id, ctxC.user.id]);

      const exactDate = await db.setting.findMany({
        where: attributeWhereEquals('setting', syntheticDateDef.key, d2.toISOString(), {
          definition: syntheticDateDef,
        }),
      });
      expect(exactDate.map((row) => row.resourceUserId)).toEqual([ctxB.user.id]);

      const dateInSet = await db.setting.findMany({
        where: attributeWhereIn('setting', syntheticDateDef.key, [d1, d3], {
          definition: syntheticDateDef,
        }),
        orderBy: attributeOrderBy('setting', syntheticDateDef.key, 'desc', {
          definition: syntheticDateDef,
        }),
      });
      expect(dateInSet.map((row) => row.resourceUserId)).toEqual([ctxC.user.id, ctxA.user.id]);

      // Multi-select canonical set equality + GIN array_contains (@>) queries
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxA.user.id,
        key: syntheticMultiDef.key,
        ...encodeAttributeColumns('setting', syntheticMultiDef.key, ['security', 'inquiries'], {
          definition: syntheticMultiDef,
        }),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxB.user.id,
        key: syntheticMultiDef.key,
        ...encodeAttributeColumns('setting', syntheticMultiDef.key, ['billing', 'security'], {
          definition: syntheticMultiDef,
        }),
      });
      await createSetting({
        resourceModel: 'User',
        resourceUserId: ctxC.user.id,
        key: syntheticMultiDef.key,
        ...encodeAttributeColumns('setting', syntheticMultiDef.key, ['digest'], {
          definition: syntheticMultiDef,
        }),
      });

      const exactSetReversed = await db.setting.findMany({
        where: attributeWhereEquals(
          'setting',
          syntheticMultiDef.key,
          ['inquiries', 'security', 'inquiries'],
          { definition: syntheticMultiDef },
        ),
      });
      expect(exactSetReversed.map((row) => row.resourceUserId)).toEqual([ctxA.user.id]);

      const hasSecurity = await db.setting.findMany({
        where: attributeWhereMultiSelectContains('setting', syntheticMultiDef.key, 'security', {
          definition: syntheticMultiDef,
        }),
      });
      expect(new Set(hasSecurity.map((row) => row.resourceUserId))).toEqual(
        new Set([ctxA.user.id, ctxB.user.id]),
      );

      const hasBoth = await db.setting.findMany({
        where: attributeWhereMultiSelectContainsAll(
          'setting',
          syntheticMultiDef.key,
          ['inquiries', 'security'],
          { definition: syntheticMultiDef },
        ),
      });
      expect(hasBoth.map((row) => row.resourceUserId)).toEqual([ctxA.user.id]);

      const hasEither = await db.setting.findMany({
        where: attributeWhereMultiSelectContainsAny(
          'setting',
          syntheticMultiDef.key,
          ['billing', 'digest'],
          { definition: syntheticMultiDef },
        ),
      });
      expect(new Set(hasEither.map((row) => row.resourceUserId))).toEqual(
        new Set([ctxB.user.id, ctxC.user.id]),
      );
    });
  });

  describe('partial unique indexes across all 8 resourceModels', () => {
    it('isolates all 8 SettingResourceModel arms without cross-arm collisions and frees keys on soft-delete', async () => {
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
      const { entity: integration } = await createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
      });
      const { entity: projectIntegration } = await createProjectIntegration(
        {},
        { project, integration },
      );

      const userSetting = (
        await createSetting({
          resourceModel: 'User',
          resourceUserId: user.id,
          key: 'general.defaultTimezone',
          ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'UTC'),
        })
      ).entity;
      await createSetting({
        resourceModel: 'Organization',
        resourceOrganizationId: organization.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'America/New_York'),
      });
      await createSetting({
        resourceModel: 'OrganizationUser',
        resourceId: member.id,
        resourceOrganizationId: organization.id,
        resourceUserId: user.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Europe/London'),
      });
      await createSetting({
        resourceModel: 'Space',
        resourceOrganizationId: organization.id,
        resourceSpaceId: space.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Asia/Tokyo'),
      });
      await createSetting({
        resourceModel: 'SpaceUser',
        resourceId: spaceUser.id,
        resourceOrganizationId: organization.id,
        resourceSpaceId: space.id,
        resourceUserId: user.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Europe/Paris'),
      });
      await createSetting({
        resourceModel: 'Project',
        resourceProjectId: project.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'America/Chicago'),
      });
      await createSetting({
        resourceModel: 'Integration',
        resourceIntegrationId: integration.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'America/Los_Angeles'),
      });
      await createSetting({
        resourceModel: 'ProjectIntegration',
        resourceProjectIntegrationId: projectIntegration.id,
        key: 'general.defaultTimezone',
        ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Australia/Sydney'),
      });

      await expect(
        createSetting({
          resourceModel: 'User',
          resourceUserId: user.id,
          key: 'general.defaultTimezone',
          ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Europe/Berlin'),
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
          key: 'general.defaultTimezone',
          ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'Europe/Berlin'),
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
