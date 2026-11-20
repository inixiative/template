/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */

type Row = Record<string, unknown>;

/** The columns that place a row under a tenant. */
export const TENANT_COLUMNS = ['organizationId', 'spaceId', 'userId'] as const;

const loaded = (value: unknown): Row | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : undefined;

/**
 * The tenant rows a hydrated record sits under, nearest first: its space, then the organization
 * (its own, or the space's). Its user only when no organization or space holds it: a member row
 * and what it owns carry `userId` too, and belong to the organization.
 */
export const tenantRowsAbove = (record: Row): Row[] => {
  const space = loaded(record.space);
  const organization = loaded(record.organization) ?? loaded(space?.organization);
  const tenants = [space, organization].filter((row) => row !== undefined);
  if (tenants.length) return tenants;
  const user = loaded(record.user);
  return user ? [user] : [];
};
