import type { Context } from 'hono';
import { type TokenWithRelations, getToken } from '#/lib/context/getToken';
import { getUser } from '#/lib/context/getUser';
import type { AppEnv } from '#/types/appEnv';

type OrgUserFromToken = NonNullable<TokenWithRelations['organizationUser']>;
type OrgUserWithoutRelations = Omit<OrgUserFromToken, 'user' | 'organization'>;

type SpaceUserFromToken = NonNullable<TokenWithRelations['spaceUser']>;
type SpaceUserWithoutRelations = Omit<SpaceUserFromToken, 'user' | 'space'>;

type SpaceFromToken = NonNullable<TokenWithRelations['space']>;
type SpaceWithoutRelations = Omit<SpaceFromToken, 'organization'>;

export const getActor = (c: Context<AppEnv>) => {
  const token = getToken(c);
  const orgUser = token?.organizationUser;
  const spaceUserFromToken = token?.spaceUser;

  // Organization context (from orgUser token, space token, or org token)
  const organization =
    orgUser?.organization ??
    spaceUserFromToken?.space?.organization ??
    token?.space?.organization ??
    token?.organization ??
    null;

  // User context
  const user = getUser(c) ?? orgUser?.user ?? spaceUserFromToken?.user ?? token?.user ?? null;

  // OrgUser context (only from orgUser token)
  let organizationUser: OrgUserWithoutRelations | null = null;
  if (orgUser) {
    const { user: _, organization: __, ...rest } = orgUser;
    organizationUser = rest;
  }

  // Space context (from spaceUser token or space token)
  let space: SpaceWithoutRelations | null = null;
  if (spaceUserFromToken?.space) {
    const { organization: _, ...spaceRest } = spaceUserFromToken.space;
    space = spaceRest;
  } else if (token?.space) {
    const { organization: _, ...spaceRest } = token.space;
    space = spaceRest;
  }

  // SpaceUser context (only from spaceUser token)
  let spaceUser: SpaceUserWithoutRelations | null = null;
  if (spaceUserFromToken) {
    const { user: _, space: __, ...rest } = spaceUserFromToken;
    spaceUser = rest;
  }

  return {
    user,
    organization,
    organizationUser,
    space,
    spaceUser,
    token,
  };
};
