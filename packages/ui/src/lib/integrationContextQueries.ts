/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  integrationDelete,
  meCreateIntegration,
  meReadManyIntegrations,
  meReadManyIntegrationsQueryKey,
  organizationCreateIntegration,
  organizationReadManyIntegrations,
  organizationReadManyIntegrationsQueryKey,
  spaceCreateIntegration,
  spaceReadManyIntegrations,
  spaceReadManyIntegrationsQueryKey,
} from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { makeContextQueries, mutation, query } from '@template/ui/lib/makeContextQueries';

const listQuery = { pageSize: 100 };

export const integrationContextQueries = makeContextQueries()({
  user: () => ({
    readMany: query({
      queryKey: meReadManyIntegrationsQueryKey({ query: listQuery }),
      queryFn: apiQuery((opts: Parameters<typeof meReadManyIntegrations>[0]) =>
        meReadManyIntegrations({ ...opts, query: listQuery }),
      ),
    }),
    create: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof meCreateIntegration>[0]) =>
        meCreateIntegration(opts),
      ),
    }),
    delete: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof integrationDelete>[0]) =>
        integrationDelete(opts),
      ),
    }),
  }),
  organization: ({ organization }) => ({
    readMany: query({
      queryKey: organizationReadManyIntegrationsQueryKey({
        path: { id: organization.id },
        query: listQuery,
      }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManyIntegrations>[0]) =>
        organizationReadManyIntegrations({
          ...opts,
          path: { id: organization.id },
          query: listQuery,
        }),
      ),
    }),
    create: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof meCreateIntegration>[0]) =>
        organizationCreateIntegration({ ...opts, path: { id: organization.id } }),
      ),
    }),
    delete: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof integrationDelete>[0]) =>
        integrationDelete(opts),
      ),
    }),
  }),
  space: ({ space }) => ({
    readMany: query({
      queryKey: spaceReadManyIntegrationsQueryKey({ path: { id: space.id }, query: listQuery }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManyIntegrations>[0]) =>
        spaceReadManyIntegrations({ ...opts, path: { id: space.id }, query: listQuery }),
      ),
    }),
    create: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof meCreateIntegration>[0]) =>
        spaceCreateIntegration({ ...opts, path: { id: space.id } }),
      ),
    }),
    delete: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof integrationDelete>[0]) =>
        integrationDelete(opts),
      ),
    }),
  }),
});
