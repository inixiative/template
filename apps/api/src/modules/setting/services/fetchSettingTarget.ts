/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { db, type HydratedRecord, hydrate } from '@template/db';
import { SettingResourceModel } from '@template/db/generated/client/enums';
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

const requireTargetKey = (value: string | undefined, field: string): string => {
  if (!value) throw makeError({ status: 422, message: `${field} is required` });
  return value;
};

export const fetchSettingTarget = async (
  input: SettingTargetInput,
): Promise<ResolvedSettingTarget> => {
  switch (input.resourceModel) {
    case SettingResourceModel.User: {
      const userId = requireTargetKey(input.resourceUserId, 'resourceUserId');
      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw makeError({ status: 404, message: 'User not found' });
      return {
        resourceModel: input.resourceModel,
        resourceId: user.id,
        targetFks: { resourceUserId: user.id },
      };
    }
    case SettingResourceModel.Organization: {
      const organizationId = requireTargetKey(
        input.resourceOrganizationId,
        'resourceOrganizationId',
      );
      const organization = await db.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!organization) throw makeError({ status: 404, message: 'Organization not found' });
      return {
        resourceModel: input.resourceModel,
        resourceId: organization.id,
        targetFks: { resourceOrganizationId: organization.id },
      };
    }
    case SettingResourceModel.OrganizationUser: {
      const organizationId = requireTargetKey(
        input.resourceOrganizationId,
        'resourceOrganizationId',
      );
      const userId = requireTargetKey(input.resourceUserId, 'resourceUserId');
      const member = await db.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { id: true },
      });
      if (!member) throw makeError({ status: 404, message: 'OrganizationUser not found' });
      return {
        resourceModel: input.resourceModel,
        resourceId: member.id,
        targetFks: { resourceOrganizationId: organizationId, resourceUserId: userId },
      };
    }
    case SettingResourceModel.Space: {
      const organizationId = requireTargetKey(
        input.resourceOrganizationId,
        'resourceOrganizationId',
      );
      const spaceId = requireTargetKey(input.resourceSpaceId, 'resourceSpaceId');
      const space = await db.space.findUnique({
        where: { organizationId_id: { organizationId, id: spaceId } },
        select: { id: true },
      });
      if (!space) throw makeError({ status: 404, message: 'Space not found' });
      return {
        resourceModel: input.resourceModel,
        resourceId: space.id,
        targetFks: { resourceOrganizationId: organizationId, resourceSpaceId: space.id },
      };
    }
    case SettingResourceModel.SpaceUser: {
      const organizationId = requireTargetKey(
        input.resourceOrganizationId,
        'resourceOrganizationId',
      );
      const spaceId = requireTargetKey(input.resourceSpaceId, 'resourceSpaceId');
      const userId = requireTargetKey(input.resourceUserId, 'resourceUserId');
      const spaceUser = await db.spaceUser.findUnique({
        where: { organizationId_spaceId_userId: { organizationId, spaceId, userId } },
        select: { id: true },
      });
      if (!spaceUser) throw makeError({ status: 404, message: 'SpaceUser not found' });
      return {
        resourceModel: input.resourceModel,
        resourceId: spaceUser.id,
        targetFks: {
          resourceOrganizationId: organizationId,
          resourceSpaceId: spaceId,
          resourceUserId: userId,
        },
      };
    }
    case SettingResourceModel.Project: {
      const projectId = requireTargetKey(input.resourceProjectId, 'resourceProjectId');
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) throw makeError({ status: 404, message: 'Project not found' });
      return {
        resourceModel: input.resourceModel,
        resourceId: project.id,
        targetFks: { resourceProjectId: project.id },
      };
    }
  }
};

/** Checks `action` on a hydrated pseudo Setting placed under `target` via ReBAC. */
export const authorizeSettingTarget = async (
  permix: Permix,
  target: ResolvedSettingTarget,
  action: string,
): Promise<void> => {
  const pseudo = await hydrate('setting', {
    id: '',
    resourceModel: target.resourceModel,
    resourceId: target.resourceId,
    ...target.targetFks,
  } as HydratedRecord);

  if (!check(permix, rebacSchema, 'setting', pseudo, action)) {
    throw makeError({ status: 403, message: 'Access denied' });
  }
};
