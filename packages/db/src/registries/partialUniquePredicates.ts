/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

type PrismaWhere = Readonly<Record<string, unknown>>;

const ownedBy = (ownerModel: string): PrismaWhere => ({ ownerModel, deletedAt: null });
const rootOwnedBy = (ownerModel: string): PrismaWhere => ({ kind: 'root', ...ownedBy(ownerModel) });
const grantedTo = (granteeModel: string): PrismaWhere => ({ granteeModel, deletedAt: null });
const settingOn = (resourceModel: string): PrismaWhere => ({ resourceModel, deletedAt: null });
const emailOwnedBy = (ownerModel: string): PrismaWhere => ({ ownerModel });
const platformEmail: PrismaWhere = { ownerModel: { in: ['default', 'admin'] } };
const platformTag: PrismaWhere = { ownerModel: 'platform' };

/** The `where` of each partial unique index whose predicate is more than its key columns being set, as a Prisma filter, keyed by the index's map name. */
export const partialUniquePredicates: Readonly<Record<string, PrismaWhere>> = {
  Artifact_root_user_key: rootOwnedBy('User'),
  Artifact_root_organization_key: rootOwnedBy('Organization'),
  Artifact_root_space_key: rootOwnedBy('Space'),
  Artifact_root_organization_user_key: rootOwnedBy('OrganizationUser'),
  Artifact_root_space_user_key: rootOwnedBy('SpaceUser'),
  ArtifactPermission_user_key: grantedTo('User'),
  ArtifactPermission_organization_key: grantedTo('Organization'),
  ArtifactPermission_space_key: grantedTo('Space'),
  ArtifactPermission_organization_user_key: grantedTo('OrganizationUser'),
  ArtifactPermission_space_user_key: grantedTo('SpaceUser'),
  ArtifactPermission_customer_relationship_key: grantedTo('CustomerRelationship'),
  EmailComponent_slug_locale_platform_key: platformEmail,
  EmailComponent_slug_locale_organization_key: emailOwnedBy('Organization'),
  EmailComponent_slug_locale_space_key: emailOwnedBy('Space'),
  EmailComponent_slug_locale_user_key: emailOwnedBy('User'),
  EmailComponent_slug_locale_orguser_key: emailOwnedBy('OrganizationUser'),
  EmailComponent_slug_locale_spaceuser_key: emailOwnedBy('SpaceUser'),
  EmailTemplate_slug_locale_platform_key: platformEmail,
  EmailTemplate_slug_locale_organization_key: emailOwnedBy('Organization'),
  EmailTemplate_slug_locale_space_key: emailOwnedBy('Space'),
  EmailTemplate_slug_locale_user_key: emailOwnedBy('User'),
  EmailTemplate_slug_locale_orguser_key: emailOwnedBy('OrganizationUser'),
  EmailTemplate_slug_locale_spaceuser_key: emailOwnedBy('SpaceUser'),
  Integration_user_name_key: ownedBy('User'),
  Integration_organization_name_key: ownedBy('Organization'),
  Integration_space_name_key: ownedBy('Space'),
  Integration_orguser_name_key: ownedBy('OrganizationUser'),
  Integration_spaceuser_name_key: ownedBy('SpaceUser'),
  Project_user_name_key: ownedBy('User'),
  Project_organization_name_key: ownedBy('Organization'),
  Project_space_name_key: ownedBy('Space'),
  Project_orguser_name_key: ownedBy('OrganizationUser'),
  Project_spaceuser_name_key: ownedBy('SpaceUser'),
  Setting_user_key_unique: settingOn('User'),
  Setting_organization_key_unique: settingOn('Organization'),
  Setting_space_key_unique: settingOn('Space'),
  Setting_orguser_key_unique: settingOn('OrganizationUser'),
  Setting_spaceuser_key_unique: settingOn('SpaceUser'),
  Setting_project_key_unique: settingOn('Project'),
  Setting_integration_key_unique: settingOn('Integration'),
  Setting_projectintegration_key_unique: settingOn('ProjectIntegration'),
  Tag_tagCategoryId_name_key: platformTag,
  TagCategory_name_key: platformTag,
};
