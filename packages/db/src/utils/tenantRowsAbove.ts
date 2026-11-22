/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldAtPath } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  type BindableOwnerModel,
  isBindableOwnerModel,
} from '@template/db/registries/polymorphicAxisPointsAt';
import { type ModelName, modelNames } from '@template/db/utils/modelNames';
import { namedSideAxesOf, relationToKindOnSide } from '@template/db/utils/polymorphicSides';

type Row = Record<string, unknown>;

/** The columns that place a row under a tenant. */
export const TENANT_COLUMNS = ['organizationId', 'spaceId', 'userId'] as const;

const loaded = (value: unknown): Row | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : undefined;

/**
 * The tenant rows a hydrated record sits under, nearest first: its space, then the organization
 * (its own, or the space's). Its user only when no organization or space holds it: a member row
 * and what it owns carry `userId` too, and belong to the organization. The id columns say who holds
 * it, so a record whose organization or space is not loaded never reads its user's.
 */
export const tenantRowsAbove = (record: Row): { model: BindableOwnerModel; row: Row }[] => {
  const space = loaded(record.space);
  const organization = loaded(record.organization) ?? loaded(space?.organization);
  const tenants = [
    ...(space ? [{ model: 'Space' as const, row: space }] : []),
    ...(organization ? [{ model: 'Organization' as const, row: organization }] : []),
  ];
  if (tenants.length || record.organizationId || record.spaceId) return tenants;
  const user = loaded(record.user);
  return user ? [{ model: 'User', row: user }] : [];
};

/** The relations of a two-sided model that reach a tenant of this kind, one per side that can be one (`sourceOrganization`, `targetOrganization`). */
export const relationsToTenantOnSides = (
  model: ModelName,
  tenantModel: BindableOwnerModel,
): string[] =>
  namedSideAxesOf(model).flatMap((axis) => relationToKindOnSide(model, axis, tenantModel) ?? []);

/**
 * The tenants on each side of a two-sided record, with the relation that reaches each: the party
 * when it is itself a user, organization or space, and a space's organization above it. A side
 * that is a member, or something a tenant holds, names none: what is addressed to a member is the
 * member's.
 */
export const tenantRowsOnSides = (
  model: ModelName,
  record: Row,
): { model: BindableOwnerModel; row: Row; relation: string }[] =>
  namedSideAxesOf(model).flatMap((axis) => {
    const party = record[axis.field];
    if (typeof party !== 'string' || !isBindableOwnerModel(party)) return [];
    const tenantModels: BindableOwnerModel[] =
      party === 'Space' ? ['Space', 'Organization'] : [party];
    return tenantModels.flatMap((tenantModel) => {
      const relation = relationToKindOnSide(model, axis, tenantModel);
      const row = relation ? loaded(record[relation]) : undefined;
      return relation && row ? [{ model: tenantModel, row, relation }] : [];
    });
  });

/**
 * The models a tenant of this kind can hold, read off the tenant columns as `tenantRowsAbove`
 * reads a record: a space what has `spaceId`, an organization that and what has `organizationId`,
 * a user what has `userId` and can be held by no organization or space.
 */
export const modelsHeldUnderTenant = (tenantModel: BindableOwnerModel): ModelName[] =>
  modelNames.filter((model) => {
    if (relationsToTenantOnSides(model, tenantModel).length) return true;
    const column = (name: (typeof TENANT_COLUMNS)[number]) => fieldAtPath(prismaMap, model, name);
    if (tenantModel === 'Space') return Boolean(column('spaceId'));
    if (tenantModel === 'Organization')
      return Boolean(column('organizationId') || column('spaceId'));
    return (
      Boolean(column('userId')) &&
      !column('organizationId')?.isRequired &&
      !column('spaceId')?.isRequired
    );
  });
