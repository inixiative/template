/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, primitive:authz
 * @uses primitive:errors
 */
import type { Prisma } from '@template/db';
import { createInterpolator } from '@template/permissions';
import { entitlementsSchema } from '@template/permissions/entitlementsSchema';
import { interpolateOr422 } from '#/lib/permissions/interpolateOr422';

const selfGrant = createInterpolator(['self']);

export const bindIntegrationEntitlements = (
  draft: Prisma.IntegrationUncheckedCreateInput,
): Prisma.IntegrationUncheckedCreateInput => {
  const { entitlements: _entitlements, ...self } = draft;
  const bound = interpolateOr422(selfGrant, entitlementsSchema.parse(draft.entitlements ?? null), {
    self,
  });
  return { ...draft, entitlements: bound === null ? undefined : (bound as Prisma.InputJsonValue) };
};
