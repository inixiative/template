import type { Context } from 'hono';
import type { TokenWithRelations } from '#/lib/context/types';
import type { AppEnv } from '#/types/appEnv';

type OrgUserFromToken = NonNullable<TokenWithRelations['organizationUser']>;
type OrgUserWithoutRelations = Omit<OrgUserFromToken, 'user' | 'organization'>;

type SpaceUserFromToken = NonNullable<TokenWithRelations['spaceUser']>;
type SpaceUserWithoutRelations = Omit<SpaceUserFromToken, 'user' | 'organization' | 'organizationUser' | 'space'>;

export const getActor = (c: Context<AppEnv>) => {
  const token = c.get('token');
  const orgUser = token?.organizationUser;
  const spcUser = token?.spaceUser;

  const organization = orgUser?.organization ?? spcUser?.organization ?? token?.organization ?? null;
  const user = c.get('user') ?? orgUser?.user ?? spcUser?.user ?? token?.user ?? null;
  const space = spcUser?.space ?? token?.space ?? null;

  let organizationUser: OrgUserWithoutRelations | null = null;
  if (orgUser) {
    const { user: _, organization: __, ...rest } = orgUser;
    organizationUser = rest;
  } else if (spcUser?.organizationUser) {
    organizationUser = spcUser.organizationUser;
  }

  let spaceUser: SpaceUserWithoutRelations | null = null;
  if (spcUser) {
    const { user: _, organization: __, organizationUser: ___, space: ____, ...rest } = spcUser;
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
