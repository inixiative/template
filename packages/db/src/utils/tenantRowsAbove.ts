/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldAtPath } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { BindableOwnerModel } from '@template/db/registries/polymorphicAxisPointsAt';
import { type ModelName, modelNames } from '@template/db/utils/modelNames';

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
export const tenantRowsAbove = (record: Row): Row[] => {
  const space = loaded(record.space);
  const organization = loaded(record.organization) ?? loaded(space?.organization);
  const tenants = [space, organization].filter((row) => row !== undefined);
  if (tenants.length || record.organizationId || record.spaceId) return tenants;
  const user = loaded(record.user);
  return user ? [user] : [];
};

/**
 * The models a tenant of this kind can hold, read off the tenant columns as `tenantRowsAbove`
 * reads a record: a space what has `spaceId`, an organization that and what has `organizationId`,
 * a user what has `userId` and can be held by no organization or space.
 */
export const modelsHeldUnderTenant = (tenantModel: BindableOwnerModel): ModelName[] =>
  modelNames.filter((model) => {
    const [organizationId, spaceId, userId] = TENANT_COLUMNS.map((column) =>
      fieldAtPath(prismaMap, model, column),
    );
    if (tenantModel === 'Space') return Boolean(spaceId);
    if (tenantModel === 'Organization') return Boolean(organizationId || spaceId);
    return Boolean(userId) && !organizationId?.isRequired && !spaceId?.isRequired;
  });
