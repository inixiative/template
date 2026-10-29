/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma, infrastructure:redis, feature:users
 */
import {
  cache,
  cacheKey,
  db,
  type HydratedRecord,
  hydrate,
  toAccessor,
  type UserWithRelations,
} from '@template/db';
import type { Integration, Token, TokenOwnerModel } from '@template/db/generated/client/client';
import { standsOnMalformedEntitlements } from '@template/permissions';
import type { TokenWithRelations } from '#/lib/context/types';
import { findUserWithRelations } from '#/modules/user/services/find';

export type TokenContext = { token: TokenWithRelations; user: UserWithRelations | null };
export type TokenSignIn = { context: TokenContext; fetched: boolean };

const TOKEN_CACHE_TTL = 60 * 10;

const memberParts: Partial<Record<TokenOwnerModel, readonly string[]>> = {
  OrganizationUser: ['organization', 'user'],
  SpaceUser: ['organization', 'organizationUser', 'space', 'user'],
};

const ownerIsPresent = (token: HydratedRecord & Token): boolean => {
  const owner = token[toAccessor(token.ownerModel)] as HydratedRecord | undefined;
  return Boolean(owner) && (memberParts[token.ownerModel] ?? []).every((part) => owner?.[part]);
};

export const loadTokenContext = async (keyHash: string): Promise<TokenSignIn | null> => {
  let fetched = false;
  const row = await cache<Token | null>(
    cacheKey('Token', { keyHash }),
    async () => {
      fetched = true;
      return db.token.findUnique({ where: { keyHash } });
    },
    TOKEN_CACHE_TTL,
  );

  if (!row?.isActive) return null;
  if (row.expiresAt && row.expiresAt <= new Date()) return null;

  const token = await hydrate('token', row);
  if (!ownerIsPresent(token)) return null;
  if (
    standsOnMalformedEntitlements(token) ||
    standsOnMalformedEntitlements(token.integration as Integration | null | undefined)
  )
    return null;

  const user =
    token.ownerModel === 'User' && token.userId ? await findUserWithRelations(token.userId) : null;
  return { context: { token: token as unknown as TokenWithRelations, user }, fetched };
};
