/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, primitive:caching, primitive:requestContext
 */
import { cache, cacheKey, db } from '@template/db';
import type { CustomerRef } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import { type ResolvedFlags, resolveFlags } from '#/modules/featureFlag/services/resolveFlags';
import type { AppEnv } from '#/types/appEnv';

const REFS_TTL = 60 * 10;

const refsOf = (
  domain: 'user' | 'organization' | 'space',
  column: 'customerUserId' | 'customerOrganizationId' | 'customerSpaceId',
  id: string,
): Promise<CustomerRef[]> =>
  cache(
    cacheKey(domain, id, ['customerRefs']),
    () => db.customerRef.findMany({ where: { [column]: id, deletedAt: null } }),
    REFS_TTL,
  );

const platformOnly = (refs: CustomerRef[]): CustomerRef[] => refs.filter((ref) => ref.providerModel === 'platform');

const subjectRefs = async (c: Context<AppEnv>): Promise<CustomerRef[]> => {
  const user = c.get('user');
  const token = c.get('token');
  const organizations = user ? (c.get('organizations') ?? []) : token?.organization ? [token.organization] : [];
  const spaces = user ? (c.get('spaces') ?? []) : token?.space ? [token.space] : [];
  const [own, orgRefs, spaceRefs] = await Promise.all([
    user ? refsOf('user', 'customerUserId', user.id) : Promise.resolve([]),
    Promise.all(organizations.map((org) => refsOf('organization', 'customerOrganizationId', org.id))),
    Promise.all(spaces.map((space) => refsOf('space', 'customerSpaceId', space.id))),
  ]);
  return [...own, ...platformOnly(orgRefs.flat()), ...platformOnly(spaceRefs.flat())];
};

export const requestFeatureFlags = async (c: Context<AppEnv>): Promise<ResolvedFlags> => {
  const memo = c.get('featureFlags');
  if (memo) return memo;
  const resolved = await resolveFlags(await subjectRefs(c));
  c.set('featureFlags', resolved);
  return resolved;
};
