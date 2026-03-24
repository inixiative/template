import {
  meCreateToken,
  meReadManyTokens,
  meReadManyTokensQueryKey,
  organizationCreateToken,
  organizationReadManyTokens,
  organizationReadManyTokensQueryKey,
  spaceCreateToken,
  spaceReadManyTokens,
  spaceReadManyTokensQueryKey,
  tokenDelete,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { makeContextQueries } from '@template/ui/lib/makeContextQueries';

export const tokenContextQueries = makeContextQueries()({
  user: () => ({
    readMany: {
      queryKey: meReadManyTokensQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManyTokens>[0]) => meReadManyTokens(opts)),
    },
    create: {
      mutationFn: apiMutation((opts: Parameters<typeof meCreateToken>[0]) => meCreateToken(opts)),
    },
    delete: {
      mutationFn: apiMutation((opts: Parameters<typeof tokenDelete>[0]) => tokenDelete(opts)),
    },
  }),
  organization: ({ organization }) => ({
    readMany: {
      queryKey: organizationReadManyTokensQueryKey({ path: { id: organization.id } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManyTokens>[0]) =>
        organizationReadManyTokens({ ...opts, path: { id: organization.id } }),
      ),
    },
    create: {
      mutationFn: apiMutation((opts: Parameters<typeof meCreateToken>[0]) =>
        organizationCreateToken({ ...opts, path: { id: organization.id } }),
      ),
    },
    delete: {
      mutationFn: apiMutation((opts: Parameters<typeof tokenDelete>[0]) => tokenDelete(opts)),
    },
  }),
  space: ({ space }) => ({
    readMany: {
      queryKey: spaceReadManyTokensQueryKey({ path: { id: space.id } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManyTokens>[0]) =>
        spaceReadManyTokens({ ...opts, path: { id: space.id } }),
      ),
    },
    create: {
      mutationFn: apiMutation((opts: Parameters<typeof meCreateToken>[0]) =>
        spaceCreateToken({ ...opts, path: { id: space.id } }),
      ),
    },
    delete: {
      mutationFn: apiMutation((opts: Parameters<typeof tokenDelete>[0]) => tokenDelete(opts)),
    },
  }),
});
