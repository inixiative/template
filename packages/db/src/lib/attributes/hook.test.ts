import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
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

describe('registerAttributeValidationHook (DB write-time invariant hook)', () => {
  beforeEach(() => {
    clearHookRegistry();
    registerAttributeValidationHook();
  });

  afterEach(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  it('rejects unknown setting keys and disallowed resourceModels', async () => {
    const { entity: user } = await createUser();
    await expect(
      createSetting({
        resourceModel: 'User',
        resourceUserId: user.id,
        key: 'nonexistent.key',
        valueBoolean: true,
        valueJson: Prisma.DbNull,
      }),
    ).rejects.toThrow(/Unknown setting key/);

    const { entity: org } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    await expect(
      createSetting({
        resourceModel: 'Project',
        resourceProjectId: project.id,
        key: 'member.autoAcceptInquiries',
        valueBoolean: true,
        valueJson: Prisma.DbNull,
      }),
    ).rejects.toThrow(/not valid for resourceModel='Project'/);
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
      key: 'notifications.topics',
      valueJson: ['security', 'inquiries', 'security', 'billing', 'inquiries'],
    });
    expect(created.valueJson).toEqual(['billing', 'inquiries', 'security']);

    const updated = await db.setting.update({
      where: { id: created.id },
      data: { valueJson: ['digest', 'digest', 'billing'] },
    });
    expect(updated.valueJson).toEqual(['billing', 'digest']);

    const bulkScoped = await db.setting.updateManyAndReturn({
      where: { key: 'notifications.topics', resourceUserId: user.id },
      data: { valueJson: ['security', 'inquiries', 'security'] },
    });
    expect(bulkScoped).toHaveLength(1);
    expect(bulkScoped[0]?.valueJson).toEqual(['inquiries', 'security']);

    // Unscoped updateManyAndReturn with duplicates cannot assume multiSelect in before-hook
    // and MUST roll back in after-hook so duplicates never persist
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
      key: 'member.maxActiveTasks',
      ...encodeAttributeColumns('setting', 'member.maxActiveTasks', 10),
    });

    // Confirm parentOf resolves composite member arm cleanly with non-null resourceId
    expect(parentOf('Setting', setting)).toEqual({
      model: 'OrganizationUser',
      id: member.id,
    });

    const incremented = await db.setting.update({
      where: { id: setting.id },
      data: { valueNumber: { increment: 5 } },
    });
    expect(incremented.valueNumber).toBe(15);

    // Incrementing past Zod max(100) must fail validation
    await expect(
      db.setting.update({
        where: { id: setting.id },
        data: { valueNumber: { increment: 500 } },
      }),
    ).rejects.toThrow();
  });

  it('skips schema re-validation on tombstone-only deletedAt updates (update and updateManyAndReturn)', async () => {
    const { entity: user } = await createUser();

    // Simulate a legacy row whose key was later retired by inserting with hook disabled
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
    registerAttributeValidationHook();

    // Non-tombstone update on a retired key still fails validation
    await expect(
      db.setting.update({
        where: { id: legacyA.id },
        data: { valueText: 'updated' },
      }),
    ).rejects.toThrow(/Unknown setting key/);

    // Tombstone-only update succeeds cleanly so soft-delete & cascades never break
    const softDeleted = await db.setting.update({
      where: { id: legacyA.id },
      data: { deletedAt: new Date() },
    });
    expect(softDeleted.deletedAt).toBeInstanceOf(Date);

    const bulkSoftDeleted = await db.setting.updateManyAndReturn({
      where: { id: legacyB.id },
      data: { deletedAt: new Date() },
    });
    expect(bulkSoftDeleted).toHaveLength(1);
    expect(bulkSoftDeleted[0]?.deletedAt).toBeInstanceOf(Date);
  });
});
