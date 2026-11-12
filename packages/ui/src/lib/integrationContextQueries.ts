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
  organizationUserCreateIntegration,
  organizationUserReadManyIntegrations,
  organizationUserReadManyIntegrationsInfiniteQueryKey,
  spaceCreateIntegration,
  spaceReadManyIntegrations,
  spaceReadManyIntegrationsInfiniteQueryKey,
  spaceUserCreateIntegration,
  spaceUserReadManyIntegrations,
  spaceUserReadManyIntegrationsInfiniteQueryKey,
} from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { makeContextQueries, mutation } from '@template/ui/lib/makeContextQueries';
import { myOrganizationUser, mySpaceUser } from '@template/ui/lib/myMembership';

export type IntegrationListQuery = NonNullable<MeReadManyIntegrationsData['query']>;
export type IntegrationOwnerScope = { member: boolean };

type ReadManyOptions = Parameters<typeof meReadManyIntegrations>[0];
type CreateOptions = Parameters<typeof meCreateIntegration>[0];

const deleteIntegration = mutation({
  mutationFn: apiMutation((opts: Parameters<typeof integrationDelete>[0]) =>
    integrationDelete(opts),
  ),
});

const ownerQueries = (
  readManyQueryKey: (query?: IntegrationListQuery) => QueryKey,
  readMany: (opts: ReadManyOptions) => ReturnType<typeof meReadManyIntegrations<true>>,
  create: (opts: CreateOptions) => ReturnType<typeof meCreateIntegration>,
) => ({
  readManyQueryKey,
  readMany: apiMutation(readMany),
  create: mutation({ mutationFn: apiMutation(create) }),
  delete: deleteIntegration,
});

export const integrationContextQueries = makeContextQueries<IntegrationOwnerScope>()({
  user: () =>
    ownerQueries(
      (query) => meReadManyIntegrationsInfiniteQueryKey({ query }),
      (opts) => meReadManyIntegrations({ ...opts, throwOnError: true }),
      (opts) => meCreateIntegration(opts),
    ),
  organization: ({ organization }, scope) => {
    if (!scope?.member) {
      const path = { id: organization.id };
      return ownerQueries(
        (query) => organizationReadManyIntegrationsInfiniteQueryKey({ path, query }),
        (opts) => organizationReadManyIntegrations({ ...opts, path, throwOnError: true }),
        (opts) => organizationCreateIntegration({ ...opts, path }),
      );
    }
    const path = { id: myOrganizationUser(organization.id).id };
    return ownerQueries(
      (query) => organizationUserReadManyIntegrationsInfiniteQueryKey({ path, query }),
      (opts) => organizationUserReadManyIntegrations({ ...opts, path, throwOnError: true }),
      (opts) => organizationUserCreateIntegration({ ...opts, path }),
    );
  },
  space: ({ space }, scope) => {
    if (!scope?.member) {
      const path = { id: space.id };
      return ownerQueries(
        (query) => spaceReadManyIntegrationsInfiniteQueryKey({ path, query }),
        (opts) => spaceReadManyIntegrations({ ...opts, path, throwOnError: true }),
        (opts) => spaceCreateIntegration({ ...opts, path }),
      );
    }
    const path = { id: mySpaceUser(space.id).id };
    return ownerQueries(
      (query) => spaceUserReadManyIntegrationsInfiniteQueryKey({ path, query }),
      (opts) => spaceUserReadManyIntegrations({ ...opts, path, throwOnError: true }),
      (opts) => spaceUserCreateIntegration({ ...opts, path }),
    );
  },
});
