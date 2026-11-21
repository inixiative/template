import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, encodeAttributeColumns, Prisma } from '@template/db';
import { registerAttributeValidationHook } from '@template/db/lib/attributes';
import {
  cleanupTouchedTables,
  createOrganization,
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

  it('rejects mixed typed columns across all 5 standard value columns on create and update', async () => {
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
  });

  it('deduplicates multiSelect arrays automatically on create and update', async () => {
    const { entity: user } = await createUser();
    const { entity: created } = await createSetting({
      resourceModel: 'User',
      resourceUserId: user.id,
      key: 'notifications.topics',
      valueJson: ['security', 'inquiries', 'security', 'billing', 'inquiries'],
    });
    expect(created.valueJson).toEqual(['security', 'inquiries', 'billing']);

    const updated = await db.setting.update({
      where: { id: created.id },
      data: { valueJson: ['digest', 'digest', 'billing'] },
    });
    expect(updated.valueJson).toEqual(['digest', 'billing']);
  });
});
