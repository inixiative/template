/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { ModelName } from '@template/db/utils/modelNames';

export type MemberModel = Extract<ModelName, 'OrganizationUser' | 'SpaceUser'>;

/** The models that make a user a member of a tenant, each keyed by the user it belongs to. */
export const MEMBER_MODELS: readonly MemberModel[] = ['OrganizationUser', 'SpaceUser'];
