/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { db, type HydratedRecord, hydrate, polymorphicArmColumns } from '@template/db';
import type { SettingResourceModel } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

export type SettingTargetInput = {
  resourceModel: SettingResourceModel;
  resourceUserId?: string;
  resourceOrganizationId?: string;
  resourceSpaceId?: string;
  resourceProjectId?: string;
};

export type ResolvedSettingTarget = {
  resourceModel: SettingResourceModel;
  resourceId: string;
  targetFks: Record<string, string>;
};

export const fetchSettingTarget = async (
  input: SettingTargetInput,
): Promise<ResolvedSettingTarget> => {
  const columns = polymorphicArmColumns('Setting', 'resourceModel', input.resourceModel);
  const where: Record<string, string> = {};
  const targetFks: Record<string, string> = {};

  for (const [targetColumn, armColumn] of Object.entries(columns)) {
    const value = input[armColumn as keyof SettingTargetInput];
    if (typeof value !== 'string' || !value) {
      throw makeError({ status: 422, message: `${armColumn} is required` });
    }
    where[targetColumn] = value;
    targetFks[armColumn] = value;
  }

  const row = (await db.delegate(input.resourceModel).findFirst({
    where,
    select: { id: true },
  })) as { id: string } | null;

  if (!row) {
    throw makeError({ status: 404, message: `${input.resourceModel} not found` });
  }

  return {
    resourceModel: input.resourceModel,
    resourceId: row.id,
    targetFks,
  };
};

/** Hydrates a pseudo Setting record placed under `target` for ReBAC evaluation. */
export const hydrateSettingTarget = (
  target: ResolvedSettingTarget,
  key?: string,
): Promise<HydratedRecord> =>
  hydrate('setting', {
    id: '',
    ...(key !== undefined ? { key } : {}),
    resourceModel: target.resourceModel,
    resourceId: target.resourceId,
    ...target.targetFks,
  } as HydratedRecord);

/** Checks `action` (`'manage'` or `'read'`) on a hydrated pseudo Setting for `target` + `key`. */
export const authorizeSettingTarget = async (
  permix: Permix,
  target: ResolvedSettingTarget,
  key: string,
  action: 'manage' | 'read',
): Promise<void> => {
  const pseudo = await hydrateSettingTarget(target, key);
  if (!check(permix, rebacSchema, 'setting', pseudo, action)) {
    throw makeError({ status: 403, message: 'Access denied' });
  }
};
