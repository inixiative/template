/**
 * @atlas
 * @kind query
 * @partOf feature:project, primitive:ui
 * @uses primitive:sdk
 */
import type { QueryKey } from '@tanstack/react-query';
import type { IntegrationOwnerModel, ProjectOwnerModel } from '@template/db';
import {
  type IntegrationCreateManyProjectIntegrationsData,
  integrationCreateManyProjectIntegrations,
  integrationReadManyIntegrationResources,
  integrationReadManyIntegrationResourcesQueryKey,
  integrationReadManyProjectIntegrations,
  integrationReadManyProjectIntegrationsQueryKey,
  type MeCreateProjectData,
  type MeReadManyIntegrationsResponses,
  type MeReadManyProjectsData,
  type MeReadManyProjectsResponses,
  meCreateProject,
  meReadManyIntegrations,
  meReadManyIntegrationsQueryKey,
  meReadManyProjects,
  meReadManyProjectsQueryKey,
  organizationCreateProject,
  organizationReadManyIntegrations,
  organizationReadManyIntegrationsQueryKey,
  organizationReadManyProjects,
  organizationReadManyProjectsQueryKey,
  organizationUserCreateProject,
  organizationUserReadManyIntegrations,
  organizationUserReadManyIntegrationsQueryKey,
  organizationUserReadManyProjects,
  organizationUserReadManyProjectsQueryKey,
  type ProjectCreateProjectIntegrationData,
  type ProjectReadManyProjectIntegrationsResponses,
  type ProjectUpdateData,
  projectCreateProjectIntegration,
  projectDelete,
  projectIntegrationDelete,
  projectIntegrationResourceDelete,
  projectRead,
  projectReadManyProjectIntegrations,
  projectReadManyProjectIntegrationsQueryKey,
  projectReadQueryKey,
  projectUpdate,
  spaceCreateProject,
  spaceReadManyIntegrations,
  spaceReadManyIntegrationsQueryKey,
  spaceReadManyProjects,
  spaceReadManyProjectsQueryKey,
  spaceUserCreateProject,
  spaceUserReadManyIntegrations,
  spaceUserReadManyIntegrationsQueryKey,
  spaceUserReadManyProjects,
  spaceUserReadManyProjectsQueryKey,
} from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { ClientInjectedOptions } from '@template/ui/lib/makeAuthenticatedApiFetch';
import { makeContextQueries, mutation } from '@template/ui/lib/makeContextQueries';
import {
  type MyMembershipOwnership,
  myOrganizationUserOrThrow,
  mySpaceUserOrThrow,
} from '@template/ui/lib/myMembership';
import type { AuthSlice } from '@template/ui/store/types/auth';

export type ProjectListQuery = NonNullable<MeReadManyProjectsData['query']>;
export type ProjectRecord = MeReadManyProjectsResponses[200]['data'][number];
export type ProjectIntegrationRecord =
  ProjectReadManyProjectIntegrationsResponses[200]['data'][number];
export type IntegrationSummaryRecord = MeReadManyIntegrationsResponses[200]['data'][number];

type ReadManyProjectsOptions = Parameters<typeof meReadManyProjects>[0];
type CreateProjectOptions = Parameters<typeof meCreateProject>[0];
type ReadManyIntegrationsOptions = Parameters<typeof meReadManyIntegrations>[0];

type ProjectUpdateVariables = Pick<ProjectUpdateData, 'path' | 'body'>;
type ProjectCreateIntegrationVariables = Pick<ProjectCreateProjectIntegrationData, 'path' | 'body'>;

export const projectDeleteMutationFn = apiMutation((opts: Parameters<typeof projectDelete>[0]) =>
  projectDelete({ ...opts, throwOnError: true }),
);

const deleteProject = mutation({
  mutationFn: projectDeleteMutationFn,
});

const buildProjectOwnerQueries = (
  ownerModel: ProjectOwnerModel,
  readManyQueryKey: (query?: ProjectListQuery) => QueryKey,
  readMany: (opts: ReadManyProjectsOptions) => ReturnType<typeof meReadManyProjects<true>>,
  create: (opts: CreateProjectOptions) => ReturnType<typeof meCreateProject<true>>,
) => ({
  owner: { ownerModel },
  readManyQueryKey,
  readManyQueryFn: apiQuery(readMany),
  create: mutation({ mutationFn: apiMutation(create) }),
  delete: deleteProject,
});

export type ProjectOwnerQueries = ReturnType<typeof buildProjectOwnerQueries>;

/** Tenant-context project queries for User (me), Organization, OrganizationUser, Space, and SpaceUser. */
export const projectContextQueries = makeContextQueries<MyMembershipOwnership>()({
  user: () =>
    buildProjectOwnerQueries(
      'User',
      (query) => meReadManyProjectsQueryKey({ query }),
      (opts) => meReadManyProjects({ ...opts, throwOnError: true }),
      (opts) => meCreateProject({ ...opts, throwOnError: true }),
    ),
  organization: ({ organization }, ownership) => {
    if (!ownership?.ownedByMyMembership) {
      const path = { id: organization.id };
      return buildProjectOwnerQueries(
        'Organization',
        (query) => organizationReadManyProjectsQueryKey({ path, query }),
        (opts) => organizationReadManyProjects({ ...opts, path, throwOnError: true }),
        (opts) => organizationCreateProject({ ...opts, path, throwOnError: true }),
      );
    }
    const path = { id: myOrganizationUserOrThrow(organization.id).id };
    return buildProjectOwnerQueries(
      'OrganizationUser',
      (query) => organizationUserReadManyProjectsQueryKey({ path, query }),
      (opts) => organizationUserReadManyProjects({ ...opts, path, throwOnError: true }),
      (opts) => organizationUserCreateProject({ ...opts, path, throwOnError: true }),
    );
  },
  space: ({ space }, ownership) => {
    if (!ownership?.ownedByMyMembership) {
      const path = { id: space.id };
      return buildProjectOwnerQueries(
        'Space',
        (query) => spaceReadManyProjectsQueryKey({ path, query }),
        (opts) => spaceReadManyProjects({ ...opts, path, throwOnError: true }),
        (opts) => spaceCreateProject({ ...opts, path, throwOnError: true }),
      );
    }
    const path = { id: mySpaceUserOrThrow(space.id).id };
    return buildProjectOwnerQueries(
      'SpaceUser',
      (query) => spaceUserReadManyProjectsQueryKey({ path, query }),
      (opts) => spaceUserReadManyProjects({ ...opts, path, throwOnError: true }),
      (opts) => spaceUserCreateProject({ ...opts, path, throwOnError: true }),
    );
  },
});

export type ProjectCreateBody = MeCreateProjectData['body'];

export const projectReadQueryOptions = (projectId: string) => ({
  queryKey: projectReadQueryKey({ path: { id: projectId } }),
  queryFn: apiQuery((opts: Parameters<typeof projectRead>[0]) =>
    projectRead({ ...opts, path: { id: projectId }, throwOnError: true }),
  ),
});

export const projectUpdateMutationFn = apiMutation(
  (opts: ProjectUpdateVariables & ClientInjectedOptions) =>
    projectUpdate({ ...opts, throwOnError: true }),
);

export const projectReadManyProjectIntegrationsQueryOptions = (projectId: string) => ({
  queryKey: projectReadManyProjectIntegrationsQueryKey({
    path: { id: projectId },
    query: { pageSize: 100 },
  }),
  queryFn: apiQuery((opts: Parameters<typeof projectReadManyProjectIntegrations>[0]) =>
    projectReadManyProjectIntegrations({
      ...opts,
      path: { id: projectId },
      query: { pageSize: 100 },
      throwOnError: true,
    }),
  ),
});

export const projectCreateProjectIntegrationMutationFn = apiMutation(
  (opts: ProjectCreateIntegrationVariables & ClientInjectedOptions) =>
    projectCreateProjectIntegration({ ...opts, throwOnError: true }),
);

export const projectIntegrationDeleteMutationFn = apiMutation(
  (opts: Parameters<typeof projectIntegrationDelete>[0]) =>
    projectIntegrationDelete({ ...opts, throwOnError: true }),
);

export const integrationReadManyIntegrationResourcesQueryOptions = (integrationId: string) => ({
  queryKey: integrationReadManyIntegrationResourcesQueryKey({
    path: { id: integrationId },
    query: { pageSize: 100 },
  }),
  queryFn: apiQuery((opts: Parameters<typeof integrationReadManyIntegrationResources>[0]) =>
    integrationReadManyIntegrationResources({
      ...opts,
      path: { id: integrationId },
      query: { pageSize: 100 },
      throwOnError: true,
    }),
  ),
});

export const integrationReadManyProjectIntegrationsQueryOptions = (integrationId: string) => ({
  queryKey: integrationReadManyProjectIntegrationsQueryKey({
    path: { id: integrationId },
    query: { pageSize: 100 },
  }),
  queryFn: apiQuery((opts: Parameters<typeof integrationReadManyProjectIntegrations>[0]) =>
    integrationReadManyProjectIntegrations({
      ...opts,
      path: { id: integrationId },
      query: { pageSize: 100 },
      throwOnError: true,
    }),
  ),
});

export const integrationCreateManyProjectIntegrationsMutationFn = apiMutation(
  (
    opts: Pick<IntegrationCreateManyProjectIntegrationsData, 'path' | 'body'> &
      ClientInjectedOptions,
  ) => integrationCreateManyProjectIntegrations({ ...opts, throwOnError: true }),
);

export const projectIntegrationResourceDeleteMutationFn = apiMutation(
  (opts: Parameters<typeof projectIntegrationResourceDelete>[0]) =>
    projectIntegrationResourceDelete({ ...opts, throwOnError: true }),
);

type IntegrationScopeAuth = Pick<
  AuthSlice['auth'],
  'user' | 'organizations' | 'organizationUsers' | 'spaces' | 'spaceUsers'
>;

/**
 * Returns the owner's project-list query key prefix(es) for cache invalidation
 * after updating or deleting a project.
 */
export const projectListQueryKeysForProject = (
  project: ProjectRecord,
  auth: Pick<IntegrationScopeAuth, 'organizationUsers' | 'spaceUsers'>,
): QueryKey[] => {
  switch (project.ownerModel) {
    case 'User':
      return [meReadManyProjectsQueryKey()];
    case 'Organization':
      return project.organizationId
        ? [organizationReadManyProjectsQueryKey({ path: { id: project.organizationId } })]
        : [];
    case 'OrganizationUser': {
      const member = project.organizationId
        ? auth.organizationUsers?.[project.organizationId]
        : undefined;
      return member ? [organizationUserReadManyProjectsQueryKey({ path: { id: member.id } })] : [];
    }
    case 'Space':
      return project.spaceId
        ? [spaceReadManyProjectsQueryKey({ path: { id: project.spaceId } })]
        : [];
    case 'SpaceUser': {
      const member = project.spaceId ? auth.spaceUsers?.[project.spaceId] : undefined;
      return member ? [spaceUserReadManyProjectsQueryKey({ path: { id: member.id } })] : [];
    }
  }
};

export type ConnectableIntegrationScope = {
  key: string;
  label: string;
  ownerModel: IntegrationOwnerModel;
  queryKey: QueryKey;
  queryFn: ReturnType<
    typeof apiQuery<
      (opts: ReadManyIntegrationsOptions) => ReturnType<typeof meReadManyIntegrations<true>>
    >
  >;
};

/**
 * Returns the ordered containment scopes whose Integrations are legally connectable to `project`
 * (mirroring `projectIntegrationOwner` DB hook invariants):
 * - User -> [Personal] (only when the acting user owns the personal project)
 * - Organization -> [Organization]
 * - Space -> [Space, Organization]
 * - OrganizationUser -> [Your integrations in {org} (when self), Organization]
 * - SpaceUser -> [Your integrations in {space} (when self), Space, Your integrations in {org} (when self), Organization]
 */
export const connectableIntegrationScopesForProject = (
  project: ProjectRecord,
  auth: IntegrationScopeAuth,
): ConnectableIntegrationScope[] => {
  const scopes: ConnectableIntegrationScope[] = [];
  const query = { pageSize: 100 };
  const isOwnMemberProject = Boolean(project.userId && auth.user?.id === project.userId);
  const orgName = project.organizationId
    ? (auth.organizations?.[project.organizationId]?.name ?? 'Organization')
    : 'Organization';
  const spaceName = project.spaceId ? (auth.spaces?.[project.spaceId]?.name ?? 'Space') : 'Space';

  if (project.ownerModel === 'User') {
    if (isOwnMemberProject) {
      scopes.push({
        key: 'user',
        label: 'Personal integrations',
        ownerModel: 'User',
        queryKey: meReadManyIntegrationsQueryKey({ query }),
        queryFn: apiQuery((opts: ReadManyIntegrationsOptions) =>
          meReadManyIntegrations({ ...opts, query, throwOnError: true }),
        ),
      });
    }
    return scopes;
  }

  if (project.ownerModel === 'SpaceUser' && project.spaceId && isOwnMemberProject) {
    const spaceMember = auth.spaceUsers?.[project.spaceId];
    if (spaceMember) {
      const path = { id: spaceMember.id };
      scopes.push({
        key: `spaceUser:${spaceMember.id}`,
        label: `Your integrations in ${spaceName}`,
        ownerModel: 'SpaceUser',
        queryKey: spaceUserReadManyIntegrationsQueryKey({ path, query }),
        queryFn: apiQuery((opts: ReadManyIntegrationsOptions) =>
          spaceUserReadManyIntegrations({ ...opts, path, query, throwOnError: true }),
        ),
      });
    }
  }

  if ((project.ownerModel === 'Space' || project.ownerModel === 'SpaceUser') && project.spaceId) {
    const path = { id: project.spaceId };
    scopes.push({
      key: `space:${project.spaceId}`,
      label: `${spaceName} integrations`,
      ownerModel: 'Space',
      queryKey: spaceReadManyIntegrationsQueryKey({ path, query }),
      queryFn: apiQuery((opts: ReadManyIntegrationsOptions) =>
        spaceReadManyIntegrations({ ...opts, path, query, throwOnError: true }),
      ),
    });
  }

  if (
    (project.ownerModel === 'OrganizationUser' || project.ownerModel === 'SpaceUser') &&
    project.organizationId &&
    isOwnMemberProject
  ) {
    const orgMember = auth.organizationUsers?.[project.organizationId];
    if (orgMember) {
      const path = { id: orgMember.id };
      scopes.push({
        key: `organizationUser:${orgMember.id}`,
        label: `Your integrations in ${orgName}`,
        ownerModel: 'OrganizationUser',
        queryKey: organizationUserReadManyIntegrationsQueryKey({ path, query }),
        queryFn: apiQuery((opts: ReadManyIntegrationsOptions) =>
          organizationUserReadManyIntegrations({ ...opts, path, query, throwOnError: true }),
        ),
      });
    }
  }

  if (project.organizationId) {
    const path = { id: project.organizationId };
    scopes.push({
      key: `organization:${project.organizationId}`,
      label: `${orgName} integrations`,
      ownerModel: 'Organization',
      queryKey: organizationReadManyIntegrationsQueryKey({ path, query }),
      queryFn: apiQuery((opts: ReadManyIntegrationsOptions) =>
        organizationReadManyIntegrations({ ...opts, path, query, throwOnError: true }),
      ),
    });
  }

  return scopes;
};
