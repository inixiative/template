import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db, encodeAttributeColumns, Prisma, parentOf } from '@template/db';
import { registerAttributeValidationHook } from '@template/db/lib/attributes';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createProject,
  createSetting,
  createUser,
} from '@template/db/test';
import { type AttributeFieldDefinition, defineAttributeField } from '@template/shared/attributes';
import { SETTING_TREES, settingAt } from '@template/shared/settings';

const syntheticHookDefs: Record<string, AttributeFieldDefinition> = {
  'test.topics': defineAttributeField({
    key: 'test.topics',
    valueType: 'multiSelect',
    options: ['inquiries', 'security', 'billing', 'digest'].map((value) => ({
      value,
      label: value,
    })),
    defaultValue: ['inquiries'],
    label: 'Topics',
    description: 'Synthetic multiSelect definition.',
  }),
  'test.maxTasks': defineAttributeField({
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
    description: 'Synthetic number definition.',
  }),
};

const resolveTestDefinition = (key: string) =>
  syntheticHookDefs[key] ?? settingAt(SETTING_TREES.User, key, 'every');

describe('registerAttributeValidationHook (DB write-time invariant hook)', () => {
  beforeEach(() => {
    clearHookRegistry();
    registerAttributeValidationHook({ resolveDefinition: resolveTestDefinition });
  });

  afterEach(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  it('rejects unknown setting keys', async () => {
    const { entity: user } = await createUser();
    await expect(
      createSetting({
        resourceModel: 'User',
        resourceUserId: user.id,
        key: 'nonexistent.key',
        valueBoolean: true,
        valueText: null,
        valueJson: Prisma.DbNull,
      }),
    ).rejects.toThrow(/Unknown setting key/);
  });

  it('rejects mixed typed columns and Prisma.JsonNull across all 5 standard value columns on create and update', async () => {
    const { entity: user } = await createUser();
    await expect(
      createSetting({
        resourceModel: 'User',
        resourceUserId: user.id,
        key: 'general.defaultTimezone',
        valueText: 'UTC',
        valueDate: new Date('2026-12-01T00:00:00.000Z'),
        valueJson: Prisma.DbNull,
      }),
    ).rejects.toThrow(/must be null/);

    await expect(
      createSetting({
        resourceModel: 'User',
        resourceUserId: user.id,
        key: 'general.defaultTimezone',
        valueText: 'UTC',
        valueJson: Prisma.JsonNull,
      }),
    ).rejects.toThrow(/Prisma\.JsonNull/);

    const { entity: setting } = await createSetting({
      resourceModel: 'User',
      resourceUserId: user.id,
      key: 'general.defaultTimezone',
      ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'UTC'),
    });

    await expect(
      db.setting.update({
        where: { id: setting.id },
        data: { valueNumber: 12 },
      }),
    ).rejects.toThrow(/must be null/);

    await expect(
      db.setting.update({
        where: { id: setting.id },
        data: { valueJson: Prisma.JsonNull },
      }),
    ).rejects.toThrow(/Prisma\.JsonNull/);
  });

  it('deduplicates and canonically sorts multiSelect arrays on create, update, and scoped updateManyAndReturn', async () => {
    const { entity: user } = await createUser();
    const { entity: created } = await createSetting({
      resourceModel: 'User',
      resourceUserId: user.id,
      key: 'test.topics',
      valueText: null,
      valueJson: ['security', 'inquiries', 'security', 'billing', 'inquiries'],
    });
    expect(created.valueJson).toEqual(['billing', 'inquiries', 'security']);

    const updated = await db.setting.update({
      where: { id: created.id },
      data: { valueJson: ['digest', 'digest', 'billing'] },
    });
    expect(updated.valueJson).toEqual(['billing', 'digest']);

    const bulkScoped = await db.setting.updateManyAndReturn({
      where: { key: 'test.topics', resourceUserId: user.id },
      data: { valueJson: ['security', 'inquiries', 'security'] },
    });
    expect(bulkScoped).toHaveLength(1);
    expect(bulkScoped[0]?.valueJson).toEqual(['inquiries', 'security']);

    await expect(
      db.setting.updateManyAndReturn({
        where: { id: created.id },
        data: { valueJson: ['security', 'billing', 'security'] },
      }),
    ).rejects.toThrow(/deduplicated and canonically sorted/);
  });

  it('evaluates Prisma numeric atomic ops (increment) accurately against Zod bounds on update', async () => {
    const { entity: member, context } = await createOrganizationUser();
    const { entity: setting } = await createSetting({
      resourceModel: 'OrganizationUser',
      resourceId: member.id,
      resourceOrganizationId: context.organization.id,
      resourceUserId: context.user.id,
      key: 'test.maxTasks',
      ...encodeAttributeColumns('setting', 'test.maxTasks', 10, {
        definition: syntheticHookDefs['test.maxTasks'],
      }),
    });

    expect(parentOf('Setting', setting)).toEqual({
      model: 'OrganizationUser',
      id: member.id,
    });

    const incremented = await db.setting.update({
      where: { id: setting.id },
      data: { valueNumber: { increment: 5 } },
    });
    expect(incremented.valueNumber).toBe(15);

    await expect(
      db.setting.update({
        where: { id: setting.id },
        data: { valueNumber: { increment: 500 } },
      }),
    ).rejects.toThrow();
  });

  it('skips schema re-validation on tombstone-only deletedAt updates (soft-delete AND revive)', async () => {
    const { entity: user } = await createUser();

    clearHookRegistry();
    const { entity: legacyA } = await createSetting({
      resourceModel: 'User',
      resourceUserId: user.id,
      key: 'retired.legacyKeyA',
      valueText: 'legacy',
      valueJson: Prisma.DbNull,
    });
    const { entity: legacyB } = await createSetting({
      resourceModel: 'User',
      resourceUserId: user.id,
      key: 'retired.legacyKeyB',
      valueText: 'legacy',
      valueJson: Prisma.DbNull,
    });
    registerAttributeValidationHook({ resolveDefinition: resolveTestDefinition });

    await expect(
      db.setting.update({
        where: { id: legacyA.id },
        data: { valueText: 'updated' },
      }),
    ).rejects.toThrow(/Unknown setting key/);

    // Soft-delete succeeds on retired key
    const softDeleted = await db.setting.update({
      where: { id: legacyA.id },
      data: { deletedAt: new Date() },
    });
    expect(softDeleted.deletedAt).toBeInstanceOf(Date);

    // Revive ({ deletedAt: null }) also succeeds on retired key
    const revived = await db.withDeleted(() =>
      db.setting.update({
        where: { id: legacyA.id },
        data: { deletedAt: null },
      }),
    );
    expect(revived.deletedAt).toBeNull();

    const bulkSoftDeleted = await db.setting.updateManyAndReturn({
      where: { id: legacyB.id },
      data: { deletedAt: new Date() },
    });
    expect(bulkSoftDeleted).toHaveLength(1);
    expect(bulkSoftDeleted[0]?.deletedAt).toBeInstanceOf(Date);
  });
});

describe('registerAttributeValidationHook against the setting trees', () => {
  beforeEach(() => {
    clearHookRegistry();
    registerAttributeValidationHook();
  });

  afterEach(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  it('refuses a key the resource tree does not hold', async () => {
    const { entity: org } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    await expect(
      createSetting({
        resourceModel: 'Project',
        resourceProjectId: project.id,
        key: 'general.displayLocale',
        valueText: 'en',
        valueJson: Prisma.DbNull,
      }),
    ).rejects.toThrow(/not defined on this Project/);
  });

  it('accepts a key the resource tree holds', async () => {
    const { entity: org } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    const { entity: setting } = await createSetting({
      resourceModel: 'Project',
      resourceProjectId: project.id,
      key: 'general.defaultTimezone',
      ...encodeAttributeColumns('setting', 'general.defaultTimezone', 'UTC'),
    });
    expect(setting.valueText).toBe('UTC');
  });
});
