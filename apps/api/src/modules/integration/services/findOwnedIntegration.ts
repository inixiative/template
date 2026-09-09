/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';

export type IntegrationOwnerScope = {
  userId?: string | null;
  organizationIds?: readonly string[];
  spaceIds?: readonly string[];
};

export const findOwnedIntegration = (id: string, scope: IntegrationOwnerScope) => {
  const owners: Record<string, unknown>[] = [];
  if (scope.userId) owners.push({ userId: scope.userId });
  if (scope.organizationIds?.length) owners.push({ organizationId: { in: [...scope.organizationIds] } });
  if (scope.spaceIds?.length) owners.push({ spaceId: { in: [...scope.spaceIds] } });
  if (!owners.length) return Promise.resolve(null);
  return db.integration.findFirst({ where: { id, deletedAt: null, OR: owners } });
};
