/**
 * @atlas
 * @kind query
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  meCreateToken,
  meReadManyTokens,
  meReadManyTokensQueryKey,
  organizationCreateToken,
  organizationReadManyTokens,
  organizationReadManyTokensQueryKey,
  organizationUserCreateToken,
  organizationUserReadManyTokens,
  organizationUserReadManyTokensQueryKey,
  spaceCreateToken,
  spaceReadManyTokens,
  spaceReadManyTokensQueryKey,
  spaceUserCreateToken,
  spaceUserReadManyTokens,
  spaceUserReadManyTokensQueryKey,
  tokenDelete,
} from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { makeContextQueries, mutation, query } from '@template/ui/lib/makeContextQueries';
import { myOrganizationUser, mySpaceUser } from '@template/ui/lib/myMembership';

export type TokenOwnerScope = { member: boolean };

type ReadManyOptions = Parameters<typeof meReadManyTokens>[0];
type CreateOptions = Parameters<typeof meCreateToken>[0];

const deleteToken = mutation({
  mutationFn: apiMutation((opts: Parameters<typeof tokenDelete>[0]) => tokenDelete(opts)),
});

const ownerQueries = (
  queryKey: readonly unknown[],
  readMany: (opts: ReadManyOptions) => ReturnType<typeof meReadManyTokens>,
  create: (opts: CreateOptions) => ReturnType<typeof meCreateToken>,
) => ({
  readMany: query({ queryKey, queryFn: apiQuery(readMany) }),
  create: mutation({ mutationFn: apiMutation(create) }),
  delete: deleteToken,
});

export const tokenContextQueries = makeContextQueries<TokenOwnerScope>()({
  user: () =>
    ownerQueries(
      meReadManyTokensQueryKey(),
      (opts) => meReadManyTokens(opts),
      (opts) => meCreateToken(opts),
    ),
  organization: ({ organization }, scope) => {
    if (!scope?.member) {
      const path = { id: organization.id };
      return ownerQueries(
        organizationReadManyTokensQueryKey({ path }),
        (opts) => organizationReadManyTokens({ ...opts, path }),
        (opts) => organizationCreateToken({ ...opts, path }),
      );
    }
    const path = { id: myOrganizationUser(organization.id).id };
    return ownerQueries(
      organizationUserReadManyTokensQueryKey({ path }),
      (opts) => organizationUserReadManyTokens({ ...opts, path }),
      (opts) => organizationUserCreateToken({ ...opts, path }),
    );
  },
  space: ({ space }, scope) => {
    if (!scope?.member) {
      const path = { id: space.id };
      return ownerQueries(
        spaceReadManyTokensQueryKey({ path }),
        (opts) => spaceReadManyTokens({ ...opts, path }),
        (opts) => spaceCreateToken({ ...opts, path }),
      );
    }
    const path = { id: mySpaceUser(space.id).id };
    return ownerQueries(
      spaceUserReadManyTokensQueryKey({ path }),
      (opts) => spaceUserReadManyTokens({ ...opts, path }),
      (opts) => spaceUserCreateToken({ ...opts, path }),
    );
  },
});
