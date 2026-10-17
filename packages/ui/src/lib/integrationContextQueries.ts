/**
 * @atlas
 * @kind query
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { QueryKey } from '@tanstack/react-query';
import {
  integrationDelete,
  type MeReadManyIntegrationsData,
  meCreateIntegration,
  meReadManyIntegrations,
  meReadManyIntegrationsInfiniteQueryKey,
  organizationCreateIntegration,
  organizationReadManyIntegrations,
  organizationReadManyIntegrationsInfiniteQueryKey,
  spaceCreateIntegration,
  spaceReadManyIntegrations,
  spaceReadManyIntegrationsInfiniteQueryKey,
} from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { makeContextQueries, mutation } from '@template/ui/lib/makeContextQueries';

export type IntegrationListQuery = NonNullable<MeReadManyIntegrationsData['query']>;

export const integrationContextQueries = makeContextQueries()({
  user: () => ({
    readManyQueryKey: (query?: IntegrationListQuery): QueryKey =>
      meReadManyIntegrationsInfiniteQueryKey({ query }),
    readMany: apiMutation((opts: Parameters<typeof meReadManyIntegrations>[0]) =>
      meReadManyIntegrations({ ...opts, throwOnError: true }),
    ),
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
    readManyQueryKey: (query?: IntegrationListQuery): QueryKey =>
      organizationReadManyIntegrationsInfiniteQueryKey({ path: { id: organization.id }, query }),
    readMany: apiMutation((opts: Parameters<typeof meReadManyIntegrations>[0]) =>
      organizationReadManyIntegrations({
        ...opts,
        path: { id: organization.id },
        throwOnError: true,
      }),
    ),
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
    readManyQueryKey: (query?: IntegrationListQuery): QueryKey =>
      spaceReadManyIntegrationsInfiniteQueryKey({ path: { id: space.id }, query }),
    readMany: apiMutation((opts: Parameters<typeof meReadManyIntegrations>[0]) =>
      spaceReadManyIntegrations({ ...opts, path: { id: space.id }, throwOnError: true }),
    ),
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
