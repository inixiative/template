import type { Context } from 'hono';
import { type TokenWithRelations, getToken } from '#/lib/context/getToken';
import { getUser } from '#/lib/context/getUser';
import type { AppEnv } from '#/types/appEnv';

type OrgUserFromToken = NonNullable<TokenWithRelations['organizationUser']>;
type OrgUserWithoutRelations = Omit<OrgUserFromToken, 'user' | 'organization'>;

export const getActor = (c: Context<AppEnv>) => {
  const token = getToken(c);
  const orgUser = token?.organizationUser;

  const organization = orgUser?.organization ?? token?.organization ?? null;
  const user = getUser(c) ?? orgUser?.user ?? token?.user ?? null;

  let organizationUser: OrgUserWithoutRelations | null = null;
  if (orgUser) {
    const { user: _, organization: __, ...rest } = orgUser;
    organizationUser = rest;
  }

  return {
    user,
    organization,
    organizationUser,
    token,
  };
};
