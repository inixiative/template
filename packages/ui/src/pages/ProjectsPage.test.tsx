/**
 * @atlas
 * @kind test
 * @partOf feature:project, primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@template/db/generated/client/enums';
import {
  buildIntegration,
  buildOrganization,
  buildOrganizationUser,
  buildProject,
  buildProjectIntegration,
  buildSpace,
  buildSpaceUser,
  buildUser,
} from '@template/db/test';
import type { MeReadResponses } from '@template/sdk';
import { organizationReadManyProjectsQueryKey } from '@template/sdk';
import type { SettingCatalog } from '@template/shared/settings';
import {
  connectableIntegrationScopesForProject,
  type ProjectRecord,
  projectReadQueryOptions,
} from '@template/ui/lib/projectContextQueries';
import { ProjectDetailPage } from '@template/ui/pages/ProjectDetailPage';
import { ProjectsPage } from '@template/ui/pages/ProjectsPage';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { keyBy } from 'lodash-es';

const initialState = useAppStore.getState();

const testCatalog: SettingCatalog = {
  categories: {
    general: {
      key: 'general',
      label: 'General',
      description: 'Workspace defaults.',
      order: 10,
    },
  },
  definitions: {
    'general.defaultTimezone': {
      key: 'general.defaultTimezone',
      category: 'general',
      label: 'Default Timezone',
      description: 'IANA timezone for this project.',
      resourceModels: ['Project'],
      valueType: 'text',
      schema: { type: 'string', enum: ['UTC', 'America/New_York'] },
      defaultValue: 'UTC',
      order: 10,
      permission: 'manage',
    },
    'general.syncEnabled': {
      key: 'general.syncEnabled',
      category: 'general',
      label: 'Sync Enabled',
      description: 'Toggle sync for this project integration.',
      resourceModels: ['ProjectIntegration'],
      valueType: 'boolean',
      schema: { type: 'boolean' },
      defaultValue: true,
      order: 20,
      permission: 'manage',
    },
  },
};

type RecordedRequest = { method: string; path: string; body: unknown };
type MePayload = MeReadResponses[200]['data'];

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let requests: RecordedRequest[];
let listResponses: Record<string, unknown[]>;
let singleResponses: Record<string, unknown>;
let failRoutes: Record<string, { status: number; message: string }>;

const installRealSession = async (opts: {
  user: ReturnType<Awaited<ReturnType<typeof buildUser>>['entity']['__serialize']>;
  organizations?: Array<
    ReturnType<Awaited<ReturnType<typeof buildOrganization>>['entity']['__serialize']>
  >;
  organizationUsers?: Array<
    ReturnType<Awaited<ReturnType<typeof buildOrganizationUser>>['entity']['__serialize']>
  >;
  spaces?: Array<ReturnType<Awaited<ReturnType<typeof buildSpace>>['entity']['__serialize']>>;
  spaceUsers?: Array<
    ReturnType<Awaited<ReturnType<typeof buildSpaceUser>>['entity']['__serialize']>
  >;
  context: AuthenticatedContext;
}) => {
  const organizations = opts.organizations ?? [];
  const organizationUsers = opts.organizationUsers ?? [];
  const spaces = opts.spaces ?? [];
  const spaceUsers = opts.spaceUsers ?? [];

  const me = {
    ...opts.user,
    organizations,
    organizationUsers,
    spaces,
    spaceUsers,
  } as unknown as MePayload;

  useAppStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: opts.user as unknown as typeof state.auth.user,
      organizations: keyBy(organizations, 'id') as unknown as typeof state.auth.organizations,
      organizationUsers: keyBy(
        organizationUsers,
        'organizationId',
      ) as unknown as typeof state.auth.organizationUsers,
      spaces: keyBy(spaces, 'id') as unknown as typeof state.auth.spaces,
      spaceUsers: keyBy(spaceUsers, 'spaceId') as unknown as typeof state.auth.spaceUsers,
      isAuthenticated: true,
    },
    tenant: { ...state.tenant, context: opts.context },
  }));

  await useAppStore.getState().permissions.installPermissionsForUser(me);
};

beforeEach(() => {
  listResponses = {};
  singleResponses = {};
  failRoutes = {};
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const intercept = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const path = url.pathname;
    const text = await request.clone().text();
    const body = text ? (JSON.parse(text) as unknown) : null;
    requests.push({ method: request.method, path, body });

    const failKey = `${request.method} ${path}`;
    if (failKey in failRoutes) {
      const failure = failRoutes[failKey];
      return Response.json(
        { message: failure?.message ?? 'Error' },
        { status: failure?.status ?? 500 },
      );
    }

    if (request.method === 'GET' && path === '/api/v1/setting/info') {
      return Response.json({ data: { guide: {}, types: testCatalog } });
    }
    if (request.method === 'GET' && path.endsWith('/settings')) {
      return Response.json({ data: listResponses[path] ?? [] });
    }
    if (request.method === 'PATCH' && path.endsWith('/settings')) {
      return Response.json({ data: [] });
    }
    if (request.method === 'GET' && path in singleResponses) {
      return Response.json({ data: singleResponses[path] });
    }
    if (request.method === 'GET' && path in listResponses) {
      const items = listResponses[path] ?? [];
      return Response.json({
        data: items,
        pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 },
      });
    }
    if (request.method === 'POST' && path.endsWith('/projects')) {
      const payload = body as { name: string; description?: string };
      const { entity: created } = await buildProject({
        name: payload.name,
        description: payload.description ?? null,
      });
      const serialized = created.__serialize();
      listResponses[path] = [...(listResponses[path] ?? []), serialized];
      return Response.json({ data: serialized }, { status: 201 });
    }
    if (request.method === 'PATCH' && path.startsWith('/api/v1/project/')) {
      const existing = (singleResponses[path] as Record<string, unknown>) ?? {};
      const updated = { ...existing, ...(body as Record<string, unknown>) };
      singleResponses[path] = updated;
      return Response.json({ data: updated });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/v1/project/')) {
      return new Response(null, { status: 204 });
    }
    if (request.method === 'POST' && path.endsWith('/projectIntegrations')) {
      const projectId = path.split('/')[4] ?? '';
      const integrationId = (body as { integrationId: string }).integrationId;
      const { entity: created } = await buildProjectIntegration({
        projectId,
        integrationId,
      });
      const serialized = created.__serialize();
      listResponses[path] = [...(listResponses[path] ?? []), serialized];
      return Response.json({ data: serialized }, { status: 201 });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/v1/projectIntegration/')) {
      const deletedId = path.split('/').pop();
      for (const key of Object.keys(listResponses)) {
        if (key.endsWith('/projectIntegrations')) {
          listResponses[key] = (listResponses[key] ?? []).filter(
            (row) => (row as { id: string }).id !== deletedId,
          );
        }
      }
      return new Response(null, { status: 204 });
    }
    if (request.method === 'GET' && path.endsWith('/integrations')) {
      return Response.json({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
      });
    }
    if (request.method === 'GET' && path.endsWith('/projects')) {
      return Response.json({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
      });
    }
    return Response.json({ message: `Unexpected ${request.method} ${path}` }, { status: 400 });
  };

  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.getState().permissions.clear();
  useAppStore.setState(initialState);
  client.clear();
});

describe('ProjectsPage & ProjectDetailPage (real ReBAC permissions)', () => {
  it('groups projects across 3 scopes and gates creation with real ReBAC (member vs admin vs org owner on space)', async () => {
    const { entity: user } = await buildUser();
    const { entity: org } = await buildOrganization({ name: 'Acme' });
    const { entity: space } = await buildSpace({ name: 'Core' }, { organization: org });
    const { entity: orgMember } = await buildOrganizationUser(
      { role: Role.member },
      { user, organization: org },
    );
    const { entity: orgProject } = await buildProject({
      name: 'Org API',
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    const serializedOrg = org.__serialize();
    const orgContext = {
      type: 'organization',
      organization: serializedOrg,
    } as unknown as AuthenticatedContext;

    listResponses[`/api/v1/organization/${org.id}/projects`] = [orgProject.__serialize()];

    // Org member: can create Personal & Yours in Acme, CANNOT create Acme's projects
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgMember.__serialize()],
      context: orgContext,
    });

    const openedIds: string[] = [];
    render(
      <QueryClientProvider client={client}>
        <ProjectsPage onOpenProject={(project) => openedIds.push(project.id)} />
      </QueryClientProvider>,
    );

    await screen.findByText('Org API');
    expect(
      within(screen.getByTestId('projects-section-personal')).getByRole('button', {
        name: 'New project in Personal',
      }),
    ).toBeDefined();
    expect(
      within(screen.getByTestId('projects-section-member')).getByRole('button', {
        name: 'New project in Yours in Acme',
      }),
    ).toBeDefined();
    expect(
      within(screen.getByTestId('projects-section-tenant')).queryByRole('button', {
        name: "New project in Acme's projects",
      }),
    ).toBeNull();

    // Clicking Open forwards the selected project
    fireEvent.click(within(screen.getByTestId('projects-section-tenant')).getByText('Open'));
    expect(openedIds).toEqual([orgProject.id]);
    cleanup();

    // Org admin: CAN create in Acme's projects
    const { entity: orgAdmin } = await buildOrganizationUser(
      { role: Role.admin },
      { user, organization: org },
    );
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgAdmin.__serialize()],
      context: orgContext,
    });

    render(
      <QueryClientProvider client={client}>
        <ProjectsPage />
      </QueryClientProvider>,
    );

    const newBtn = await within(screen.getByTestId('projects-section-tenant')).findByRole(
      'button',
      { name: "New project in Acme's projects" },
    );
    fireEvent.click(newBtn);
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Billing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() =>
      expect(
        requests.some(
          (req) => req.method === 'POST' && req.path === `/api/v1/organization/${org.id}/projects`,
        ),
      ).toBe(true),
    );
    cleanup();

    // Org owner with NO SpaceUser row in Space context: CAN create Space projects (Space.organization hydrated)
    const { entity: orgOwner } = await buildOrganizationUser(
      { role: Role.owner },
      { user, organization: org },
    );
    const serializedSpace = space.__serialize();
    const spaceContext = {
      type: 'space',
      organization: serializedOrg,
      space: serializedSpace,
    } as unknown as AuthenticatedContext;
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgOwner.__serialize()],
      spaces: [serializedSpace],
      spaceUsers: [],
      context: spaceContext,
    });

    render(
      <QueryClientProvider client={client}>
        <ProjectsPage />
      </QueryClientProvider>,
    );

    expect(
      await within(screen.getByTestId('projects-section-tenant')).findByRole('button', {
        name: "New project in Core's projects",
      }),
    ).toBeDefined();
  });

  it('ProjectDetailPage settings view gates project edit, ResourceSettingsSection, and delete with real ReBAC', async () => {
    const { entity: user } = await buildUser();
    const { entity: org } = await buildOrganization({ name: 'Acme' });
    const { entity: orgMember } = await buildOrganizationUser(
      { role: Role.member },
      { user, organization: org },
    );
    const { entity: orgAdmin } = await buildOrganizationUser(
      { role: Role.admin },
      { user, organization: org },
    );
    const { entity: project } = await buildProject({
      name: 'Core Platform',
      description: 'Initial desc',
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    const serializedOrg = org.__serialize();
    const orgContext = {
      type: 'organization',
      organization: serializedOrg,
    } as unknown as AuthenticatedContext;

    singleResponses[`/api/v1/project/${project.id}`] = project.__serialize();

    // Member: read-only details, no Save/Delete, read-only Project settings
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgMember.__serialize()],
      context: orgContext,
    });

    render(
      <QueryClientProvider client={client}>
        <ProjectDetailPage projectId={project.id} view="settings" />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue('Core Platform');
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete project' })).toBeNull();
    const tzSelectMember = (await screen.findByLabelText('Default Timezone')) as HTMLSelectElement;
    expect(tzSelectMember.disabled).toBe(true);
    cleanup();

    // Admin: edits project details, edits Project settings, and deletes project
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgAdmin.__serialize()],
      context: orgContext,
    });

    let navigatedBack = false;
    render(
      <QueryClientProvider client={client}>
        <ProjectDetailPage
          projectId={project.id}
          view="settings"
          onNavigateBack={() => {
            navigatedBack = true;
          }}
        />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue('Core Platform');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Core Platform v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(
        requests.some(
          (req) => req.method === 'PATCH' && req.path === `/api/v1/project/${project.id}`,
        ),
      ).toBe(true),
    );

    const tzSelectAdmin = (await screen.findByLabelText('Default Timezone')) as HTMLSelectElement;
    expect(tzSelectAdmin.disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(navigatedBack).toBe(true));
    expect(
      requests.some(
        (req) => req.method === 'DELETE' && req.path === `/api/v1/project/${project.id}`,
      ),
    ).toBe(true);
  });

  it('ProjectDetailPage integrations view groups Space + Org connectable integrations, connects/disconnects with real ReBAC, and renders ProjectIntegration settings + custom resources slot', async () => {
    const { entity: user } = await buildUser();
    const { entity: org } = await buildOrganization({ name: 'Acme' });
    const { entity: space } = await buildSpace({ name: 'Platform' }, { organization: org });
    const { entity: spaceMember } = await buildSpaceUser(
      { role: Role.member },
      { user, organization: org, space },
    );
    const { entity: orgOwner } = await buildOrganizationUser(
      { role: Role.owner },
      { user, organization: org },
    );

    const { entity: spaceProject } = await buildProject({
      name: 'Edge Service',
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    const { entity: spaceIntegrationConnected } = await buildIntegration({
      name: 'GitHub Space',
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    const { entity: spaceIntegrationAvail } = await buildIntegration({
      name: 'Linear Space',
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    const { entity: orgIntegrationAvail } = await buildIntegration({
      name: 'Slack Org',
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    const { entity: connectedLink } = await buildProjectIntegration(
      {},
      { project: spaceProject, integration: spaceIntegrationConnected },
    );

    const serializedOrg = org.__serialize();
    const serializedSpace = space.__serialize();
    const spaceContext = {
      type: 'space',
      organization: serializedOrg,
      space: serializedSpace,
    } as unknown as AuthenticatedContext;

    singleResponses[`/api/v1/project/${spaceProject.id}`] = spaceProject.__serialize();
    listResponses[`/api/v1/project/${spaceProject.id}/projectIntegrations`] = [
      connectedLink.__serialize(),
    ];
    listResponses[`/api/v1/space/${space.id}/integrations`] = [
      spaceIntegrationConnected.__serialize(),
      spaceIntegrationAvail.__serialize(),
    ];
    listResponses[`/api/v1/organization/${org.id}/integrations`] = [
      orgIntegrationAvail.__serialize(),
    ];

    // 1. Space member: sees grouped scopes excluding already-connected integration, but CANNOT connect or disconnect
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      spaces: [serializedSpace],
      spaceUsers: [spaceMember.__serialize()],
      context: spaceContext,
    });

    render(
      <QueryClientProvider client={client}>
        <ProjectDetailPage projectId={spaceProject.id} view="integrations" />
      </QueryClientProvider>,
    );

    await screen.findByText('GitHub Space');
    const spaceScope = await screen.findByTestId('connectable-scope-Space');
    const orgScope = await screen.findByTestId('connectable-scope-Organization');
    expect(within(spaceScope).getByText('Linear Space')).toBeDefined();
    expect(within(spaceScope).queryByText('GitHub Space')).toBeNull(); // already connected -> excluded!
    expect(within(orgScope).getByText('Slack Org')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Connect Linear Space' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disconnect GitHub Space' })).toBeNull();
    cleanup();

    // 2. Org owner (with NO SpaceUser row!): CAN connect org integration, expand connected link to see
    //    ProjectIntegration ResourceSettingsSection + custom resources slot, and disconnect!
    await installRealSession({
      user: user.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgOwner.__serialize()],
      spaces: [serializedSpace],
      spaceUsers: [],
      context: spaceContext,
    });

    render(
      <QueryClientProvider client={client}>
        <ProjectDetailPage
          projectId={spaceProject.id}
          view="integrations"
          renderProjectIntegrationResources={({ projectIntegration, integration }) => (
            <div>
              Custom resources for {integration?.name} ({projectIntegration.id})
            </div>
          )}
        />
      </QueryClientProvider>,
    );

    await screen.findByText('GitHub Space');

    // Expand connected ProjectIntegration -> renders BOTH ProjectIntegration settings AND custom resources slot
    fireEvent.click(screen.getByRole('button', { name: 'Configure GitHub Space' }));
    const details = await screen.findByTestId(`project-integration-details-${connectedLink.id}`);
    expect(
      within(details).getByText(`Custom resources for GitHub Space (${connectedLink.id})`),
    ).toBeDefined();
    const syncCheckbox = (await within(details).findByLabelText(
      'Sync Enabled',
    )) as HTMLInputElement;
    expect(syncCheckbox.disabled).toBe(false);

    // Connect available Org integration to Space project
    fireEvent.click(screen.getByRole('button', { name: 'Connect Slack Org' }));
    await waitFor(() =>
      expect(
        requests.some(
          (req) =>
            req.method === 'POST' &&
            req.path === `/api/v1/project/${spaceProject.id}/projectIntegrations` &&
            (req.body as { integrationId: string }).integrationId === orgIntegrationAvail.id,
        ),
      ).toBe(true),
    );

    // Disconnect original Space integration
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub Space' }));
    await waitFor(() =>
      expect(
        requests.some(
          (req) =>
            req.method === 'DELETE' &&
            req.path === `/api/v1/projectIntegration/${connectedLink.id}`,
        ),
      ).toBe(true),
    );
  });

  it('allows Org Owner to delete (but not edit) a member-owned OrganizationUser project, invalidates list cache and removes read cache on delete', async () => {
    const { entity: owner } = await buildUser();
    const { entity: memberUser } = await buildUser();
    const { entity: org } = await buildOrganization({ name: 'Acme' });
    const { entity: orgOwner } = await buildOrganizationUser(
      { role: Role.owner },
      { user: owner, organization: org },
    );
    const { entity: memberProject } = await buildProject({
      name: 'Member Scratchpad',
      ownerModel: 'OrganizationUser',
      organizationId: org.id,
      userId: memberUser.id,
    });
    const { entity: orgProject } = await buildProject({
      name: 'Org Flagship',
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    const serializedOrg = org.__serialize();
    const orgContext = {
      type: 'organization',
      organization: serializedOrg,
    } as unknown as AuthenticatedContext;

    await installRealSession({
      user: owner.__serialize(),
      organizations: [serializedOrg],
      organizationUsers: [orgOwner.__serialize()],
      context: orgContext,
    });

    // 1. Org owner viewing another member's OrganizationUser project: canManage = false, canDelete = true
    singleResponses[`/api/v1/project/${memberProject.id}`] = memberProject.__serialize();
    render(
      <QueryClientProvider client={client}>
        <ProjectDetailPage projectId={memberProject.id} view="settings" />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue('Member Scratchpad');
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save details' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeDefined();
    cleanup();

    // 2. With 60s staleTime, updating & deleting invalidates the owner list query and removes projectRead cache
    const staleClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const orgListKey = organizationReadManyProjectsQueryKey({
      path: { id: org.id },
      query: { pageSize: 100 },
    });
    staleClient.setQueryData(orgListKey, { data: [orgProject.__serialize()] });
    singleResponses[`/api/v1/project/${orgProject.id}`] = orgProject.__serialize();

    const detailView = render(
      <QueryClientProvider client={staleClient}>
        <ProjectDetailPage
          projectId={orgProject.id}
          view="settings"
          onNavigateBack={() => {
            detailView.unmount();
          }}
        />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue('Org Flagship');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Org Flagship Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() => expect(staleClient.getQueryState(orgListKey)?.isInvalidated).toBe(true));

    // Re-mark fresh, then Delete removes projectRead query and invalidates org list query
    staleClient.setQueryData(orgListKey, { data: [orgProject.__serialize()] });
    expect(staleClient.getQueryState(orgListKey)?.isInvalidated).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(staleClient.getQueryState(orgListKey)?.isInvalidated).toBe(true));
    expect(
      staleClient.getQueryState(projectReadQueryOptions(orgProject.id).queryKey),
    ).toBeUndefined();
    staleClient.clear();
  });

  it('guards User-project connectable scopes against foreign users and renders inline errors under throwOnError: true', async () => {
    const { entity: actingUser } = await buildUser();
    const { entity: otherUser } = await buildUser();
    const { entity: foreignPersonalProject } = await buildProject({
      name: 'Other Personal',
      ownerModel: 'User',
      userId: otherUser.id,
    });
    const { entity: ownPersonalProject } = await buildProject({
      name: 'My Personal',
      ownerModel: 'User',
      userId: actingUser.id,
    });

    const authStub = {
      user: actingUser.__serialize() as unknown as ReturnType<
        typeof useAppStore.getState
      >['auth']['user'],
      organizations: null,
      organizationUsers: null,
      spaces: null,
      spaceUsers: null,
    };

    // Foreign personal project must NOT include acting user's /me/integrations
    expect(
      connectableIntegrationScopesForProject(
        foreignPersonalProject.__serialize() as unknown as ProjectRecord,
        authStub,
      ),
    ).toEqual([]);
    expect(
      connectableIntegrationScopesForProject(
        ownPersonalProject.__serialize() as unknown as ProjectRecord,
        authStub,
      ).map((scope) => scope.ownerModel),
    ).toEqual(['User']);

    // QueryClient matching createAppQueryClient (throwOnError: true globally) renders inline alert + not-found cleanly
    const throwingClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, throwOnError: true },
        mutations: { throwOnError: true },
      },
    });
    await installRealSession({
      user: actingUser.__serialize(),
      context: { type: 'user' },
    });

    singleResponses[`/api/v1/project/${ownPersonalProject.id}`] = ownPersonalProject.__serialize();
    failRoutes[`PATCH /api/v1/project/${ownPersonalProject.id}`] = {
      status: 422,
      message: 'Project name invalid',
    };

    render(
      <QueryClientProvider client={throwingClient}>
        <ProjectDetailPage projectId={ownPersonalProject.id} view="settings" />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue('My Personal');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    cleanup();

    failRoutes['GET /api/v1/project/missing-id'] = { status: 404, message: 'Not found' };
    render(
      <QueryClientProvider client={throwingClient}>
        <ProjectDetailPage projectId="missing-id" view="settings" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Project not found')).toBeDefined();
    throwingClient.clear();
  });
});
