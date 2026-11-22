/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldAtPath } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { polymorphismConfigForModel } from '@template/db/registries/falsePolymorphism';
import type { BindableOwnerModel } from '@template/db/registries/polymorphicAxisPointsAt';
import { type ModelName, modelNames } from '@template/db/utils/modelNames';
import { lowerFirst } from 'lodash-es';

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
const tenantRowsAt = (record: Row, side = ''): { model: BindableOwnerModel; row: Row }[] => {
  const at = (model: BindableOwnerModel) => (side ? `${side}${model}` : lowerFirst(model));
  const space = loaded(record[at('Space')]);
  const organization = loaded(record[at('Organization')]) ?? loaded(space?.organization);
  const tenants = [
    ...(space ? [{ model: 'Space' as const, row: space }] : []),
    ...(organization ? [{ model: 'Organization' as const, row: organization }] : []),
  ];
  if (tenants.length || record[`${at('Organization')}Id`] || record[`${at('Space')}Id`])
    return tenants;
  const user = loaded(record[at('User')]);
  return user ? [{ model: 'User', row: user }] : [];
};

export const tenantRowsAbove = (record: Row): { model: BindableOwnerModel; row: Row }[] =>
  tenantRowsAt(record);

const sideAxesOf = (model: ModelName) =>
  (polymorphismConfigForModel(model)?.axes ?? []).filter(({ field }) => field !== 'ownerModel');

const sideOf = ({ field }: { field: string }) => field.replace(/Model$/, '');

/** The tenant rows on each side of a two-sided record, each with the relation that reaches it (`targetOrganization`). */
export const tenantRowsOnSides = (
  model: ModelName,
  record: Row,
): { model: BindableOwnerModel; row: Row; relation: string }[] =>
  sideAxesOf(model).flatMap((axis) =>
    tenantRowsAt(record, sideOf(axis)).map((tenant) => ({
      ...tenant,
      relation: `${sideOf(axis)}${tenant.model}`,
    })),
  );

/** The relations of a two-sided model that reach a tenant of this kind, one per side that can hold one. */
export const relationsToTenantOnSides = (
  model: ModelName,
  tenantModel: BindableOwnerModel,
): string[] =>
  sideAxesOf(model)
    .filter((axis) => tenantModel in axis.fkMap)
    .map((axis) => `${sideOf(axis)}${tenantModel}`);

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
