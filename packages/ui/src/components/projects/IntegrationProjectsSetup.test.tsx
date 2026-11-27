/**
 * @atlas
 * @kind test
 * @partOf feature:integrations, feature:project, primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  buildIntegration,
  buildIntegrationResource,
  buildOrganization,
  buildProject,
  buildProjectIntegration,
  buildProjectIntegrationResource,
} from '@template/db/test';
import type { ProjectResourceSpec } from '@template/shared/integrations';
import { IntegrationProjectsSetup } from '@template/ui/components/projects/IntegrationProjectsSetup';
import type { ProjectRecord } from '@template/ui/lib/projectContextQueries';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

type RecordedRequest = { method: string; url: string; body?: unknown };

const repoSpecs: readonly ProjectResourceSpec[] = [
  {
    kind: 'repository',
    pluralLabel: 'Repositories',
    defaultProjectName: (resource) => resource.name.split('/').pop() ?? resource.name,
  },
];

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let requests: RecordedRequest[];

const stubFetch = (handler: (req: RecordedRequest) => Response | Promise<Response>) => {
  const intercept = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const rawText =
      typeof init?.body === 'string'
        ? init.body
        : input instanceof Request && method !== 'GET' && method !== 'HEAD'
          ? await input.clone().text()
          : undefined;
    const body = rawText ? JSON.parse(rawText) : undefined;
    const recorded: RecordedRequest = { method, url, body };
    requests.push(recorded);
    return handler(recorded);
  };
  return spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  requests = [];
});

afterEach(() => {
  fetchSpy?.mockRestore();
  cleanup();
});

describe('IntegrationProjectsSetup', () => {
  it('renders nothing when no project resource specs apply', async () => {
    const { entity: organization } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: organization.id },
      { organization },
    );

    const { container } = render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={integration.__serialize()}
          projects={[]}
          projectResourceSpecs={[]}
        />
      </QueryClientProvider>,
    );

    expect(container.innerHTML).toBe('');
  });

  it('creates new projects with isIdentity, links existing projects, and unlinks skipped resources', async () => {
    const { entity: organization } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Acme GitHub' },
      { organization },
    );
    const { entity: existingProject } = await buildProject(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Core Platform' },
      { organization },
    );
    const { entity: repoNew } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/web-app', status: 'tracked' },
      { integration },
    );
    const { entity: repoLinked } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/legacy-app', status: 'tracked' },
      { integration },
    );
    const { entity: accountSingleton } = await buildIntegrationResource(
      { kind: 'account', name: 'acme', status: 'tracked' },
      { integration },
    );
    const { entity: existingProjectIntegration } = await buildProjectIntegration(
      {},
      { project: existingProject, integration },
    );
    const { entity: existingProjectIntegrationResource } = await buildProjectIntegrationResource(
      { projectIntegrationId: existingProjectIntegration.id, isIdentity: true },
      { project: existingProject, integrationResource: repoLinked },
    );

    const serializedIntegration = integration.__serialize();
    const serializedProject = existingProject.__serialize() as unknown as ProjectRecord;
    const serializedResources = [
      repoNew.__serialize(),
      repoLinked.__serialize(),
      accountSingleton.__serialize(),
    ];
    const serializedProjectIntegrations = [
      {
        ...existingProjectIntegration.__serialize(),
        project: serializedProject,
        projectIntegrationResources: [existingProjectIntegrationResource.__serialize()],
      },
    ];

    fetchSpy = stubFetch(({ method, url }) => {
      if (method === 'GET' && url.includes('/integrationResources')) {
        return Response.json({
          data: serializedResources,
          pagination: { total: 3, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'GET' && url.includes('/projectIntegrations')) {
        return Response.json({
          data: serializedProjectIntegrations,
          pagination: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (
        method === 'DELETE' &&
        url.includes(`/projectIntegrationResource/${existingProjectIntegrationResource.id}`)
      ) {
        return new Response(null, { status: 204 });
      }
      if (method === 'POST' && url.includes(`/integration/${integration.id}/projectIntegrations`)) {
        return Response.json({ data: serializedProjectIntegrations }, { status: 201 });
      }
      return Response.json({ data: [] });
    });

    render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={serializedIntegration}
          projects={[serializedProject]}
          projectResourceSpecs={repoSpecs}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('acme/web-app')).toBeTruthy();
      expect((screen.getByLabelText('acme/legacy-app') as HTMLSelectElement).value).toBe(
        existingProject.id,
      );
    });
    // Resource kinds absent from projectResourceSpecs are filtered out
    expect(screen.queryByText('acme')).toBeNull();

    fireEvent.change(screen.getByLabelText('acme/legacy-app'), { target: { value: '__skip__' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save projects' }));

    await waitFor(() => {
      expect(screen.getByText('Projects saved.')).toBeTruthy();
    });

    expect(
      requests.some(
        (r) =>
          r.method === 'DELETE' &&
          r.url.includes(`/projectIntegrationResource/${existingProjectIntegrationResource.id}`),
      ),
    ).toBe(true);

    const createReq = requests.find(
      (r) =>
        r.method === 'POST' && r.url.includes(`/integration/${integration.id}/projectIntegrations`),
    );
    expect(createReq?.body).toEqual([
      {
        project: { name: 'web-app' },
        resources: [{ integrationResourceId: repoNew.id, isIdentity: true }],
      },
    ]);
  });

  it('enforces mutual exclusion of isIdentity when two resources target the same existing project', async () => {
    const { entity: organization } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Acme GitHub' },
      { organization },
    );
    const { entity: existingProject } = await buildProject(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Core Platform' },
      { organization },
    );
    const { entity: repoA } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/core-api', status: 'tracked' },
      { integration },
    );
    const { entity: repoB } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/core-web', status: 'tracked' },
      { integration },
    );
    const { entity: existingProjectIntegration } = await buildProjectIntegration(
      {},
      { project: existingProject, integration },
    );
    const { entity: existingProjectIntegrationResource } = await buildProjectIntegrationResource(
      { projectIntegrationId: existingProjectIntegration.id, isIdentity: true },
      { project: existingProject, integrationResource: repoA },
    );

    const serializedIntegration = integration.__serialize();
    const serializedProject = existingProject.__serialize() as unknown as ProjectRecord;
    const serializedResources = [repoA.__serialize(), repoB.__serialize()];
    const serializedProjectIntegrations = [
      {
        ...existingProjectIntegration.__serialize(),
        project: serializedProject,
        projectIntegrationResources: [existingProjectIntegrationResource.__serialize()],
      },
    ];

    fetchSpy = stubFetch(({ method, url }) => {
      if (method === 'GET' && url.includes('/integrationResources')) {
        return Response.json({
          data: serializedResources,
          pagination: { total: 2, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'GET' && url.includes('/projectIntegrations')) {
        return Response.json({
          data: serializedProjectIntegrations,
          pagination: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'POST' && url.includes(`/integration/${integration.id}/projectIntegrations`)) {
        return Response.json({ data: serializedProjectIntegrations }, { status: 201 });
      }
      return Response.json({ data: [] });
    });

    render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={serializedIntegration}
          projects={[serializedProject]}
          projectResourceSpecs={repoSpecs}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect((screen.getByLabelText('acme/core-api') as HTMLSelectElement).value).toBe(
        existingProject.id,
      );
    });

    fireEvent.change(screen.getByLabelText('acme/core-web'), {
      target: { value: existingProject.id },
    });
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0]!.checked).toBe(true);
    expect(checkboxes[1]!.checked).toBe(false);

    fireEvent.click(checkboxes[1]!);
    expect(checkboxes[0]!.checked).toBe(false);
    expect(checkboxes[1]!.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save projects' }));
    await waitFor(() => {
      expect(screen.getByText('Projects saved.')).toBeTruthy();
    });

    const createReq = requests.find(
      (r) =>
        r.method === 'POST' && r.url.includes(`/integration/${integration.id}/projectIntegrations`),
    );
    expect(createReq?.body).toEqual([
      {
        projectId: existingProject.id,
        resources: [
          { integrationResourceId: repoA.id, isIdentity: false },
          { integrationResourceId: repoB.id, isIdentity: true },
        ],
      },
    ]);
  });

  it('preserves secondary project links on the same resource when skipping the displayed assignment', async () => {
    const { entity: organization } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Acme GitHub' },
      { organization },
    );
    const { entity: projectA } = await buildProject(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Org Project' },
      { organization },
    );
    const { entity: projectB } = await buildProject(
      { ownerModel: 'Organization', organizationId: organization.id, name: 'Member Sandbox' },
      { organization },
    );
    const { entity: sharedRepo } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/shared', status: 'tracked' },
      { integration },
    );
    const { entity: projectIntegrationA } = await buildProjectIntegration(
      {},
      { project: projectA, integration },
    );
    const { entity: projectIntegrationB } = await buildProjectIntegration(
      {},
      { project: projectB, integration },
    );
    const { entity: resourceLinkA } = await buildProjectIntegrationResource(
      { projectIntegrationId: projectIntegrationA.id, isIdentity: true },
      { project: projectA, integrationResource: sharedRepo },
    );
    const { entity: resourceLinkB } = await buildProjectIntegrationResource(
      { projectIntegrationId: projectIntegrationB.id, isIdentity: true },
      { project: projectB, integrationResource: sharedRepo },
    );

    const serializedProjectA = projectA.__serialize() as unknown as ProjectRecord;
    const serializedProjectB = projectB.__serialize() as unknown as ProjectRecord;

    fetchSpy = stubFetch(({ method, url }) => {
      if (method === 'GET' && url.includes('/integrationResources')) {
        return Response.json({
          data: [sharedRepo.__serialize()],
          pagination: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'GET' && url.includes('/projectIntegrations')) {
        return Response.json({
          data: [
            {
              ...projectIntegrationA.__serialize(),
              project: serializedProjectA,
              projectIntegrationResources: [resourceLinkA.__serialize()],
            },
            {
              ...projectIntegrationB.__serialize(),
              project: serializedProjectB,
              projectIntegrationResources: [resourceLinkB.__serialize()],
            },
          ],
          pagination: { total: 2, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json({ data: [] });
    });

    render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={integration.__serialize()}
          projects={[serializedProjectA, serializedProjectB]}
          projectResourceSpecs={repoSpecs}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Also linked to 1 other project.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('acme/shared'), { target: { value: '__skip__' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save projects' }));

    await waitFor(() => {
      expect(screen.getByText('Projects saved.')).toBeTruthy();
    });

    const deleteUrls = requests.filter((r) => r.method === 'DELETE').map((r) => r.url);
    expect(deleteUrls).toHaveLength(1);
    expect(deleteUrls[0]).toContain(`/projectIntegrationResource/${resourceLinkA.id}`);
    expect(deleteUrls[0]).not.toContain(resourceLinkB.id);
  });
});
