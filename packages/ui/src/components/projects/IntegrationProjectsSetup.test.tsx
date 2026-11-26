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
    singularLabel: 'Repository',
    pluralLabel: 'Repositories',
    defaultProjectName: (resource) => resource.name.split('/').pop() ?? resource.name,
  },
];

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let requests: RecordedRequest[];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

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
  it('renders nothing when no resource specs apply', async () => {
    const { entity: org } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: org.id },
      { organization: org },
    );

    const { container } = render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={integration.__serialize()}
          projects={[]}
          resourceSpecs={[]}
        />
      </QueryClientProvider>,
    );

    expect(container.innerHTML).toBe('');
  });

  it('creates new projects with isIdentity, attaches existing projects, and unlinks skipped resources', async () => {
    const { entity: org } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: org.id, name: 'Acme GitHub' },
      { organization: org },
    );
    const { entity: existingProject } = await buildProject(
      { ownerModel: 'Organization', organizationId: org.id, name: 'Core Platform' },
      { organization: org },
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
    const { entity: existingLink } = await buildProjectIntegration(
      {},
      { project: existingProject, integration },
    );
    const { entity: existingResLink } = await buildProjectIntegrationResource(
      { projectIntegrationId: existingLink.id, isIdentity: true },
      { project: existingProject, integrationResource: repoLinked },
    );

    const serializedIntegration = integration.__serialize();
    const serializedProject = existingProject.__serialize() as unknown as ProjectRecord;
    const serializedResources = [
      repoNew.__serialize(),
      repoLinked.__serialize(),
      accountSingleton.__serialize(),
    ];
    const serializedLinks = [
      {
        ...existingLink.__serialize(),
        project: serializedProject,
        projectIntegrationResources: [existingResLink.__serialize()],
      },
    ];

    fetchSpy = stubFetch(({ method, url }) => {
      if (method === 'GET' && url.includes('/integrationResources')) {
        return jsonResponse({
          data: serializedResources,
          pagination: { total: 3, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'GET' && url.includes('/projectIntegrations')) {
        return jsonResponse({
          data: serializedLinks,
          pagination: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (
        method === 'DELETE' &&
        url.includes(`/projectIntegrationResource/${existingResLink.id}`)
      ) {
        return new Response(null, { status: 204 });
      }
      if (method === 'POST' && url.includes(`/integration/${integration.id}/projectIntegrations`)) {
        return jsonResponse({ data: serializedLinks }, 201);
      }
      return jsonResponse({ data: [] });
    });

    render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={serializedIntegration}
          projects={[serializedProject]}
          resourceSpecs={repoSpecs}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('acme/web-app')).toBeTruthy();
      expect((screen.getByLabelText('acme/legacy-app') as HTMLSelectElement).value).toBe(
        existingProject.id,
      );
    });
    // Non-translatable 'account' resource is filtered out
    expect(screen.queryByText('acme')).toBeNull();

    // Switch acme/legacy-app to Skip so it unlinks; leave acme/web-app as New project: web-app (isIdentity: true)
    const legacySelect = screen.getByLabelText('acme/legacy-app');
    fireEvent.change(legacySelect, { target: { value: '__skip__' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save projects' }));

    await waitFor(() => {
      expect(screen.getByText('Projects saved.')).toBeTruthy();
    });

    expect(
      requests.some(
        (r) =>
          r.method === 'DELETE' &&
          r.url.includes(`/projectIntegrationResource/${existingResLink.id}`),
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
    const { entity: org } = await buildOrganization();
    const { entity: integration } = await buildIntegration(
      { ownerModel: 'Organization', organizationId: org.id, name: 'Acme GitHub' },
      { organization: org },
    );
    const { entity: existingProject } = await buildProject(
      { ownerModel: 'Organization', organizationId: org.id, name: 'Core Platform' },
      { organization: org },
    );
    const { entity: repoA } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/core-api', status: 'tracked' },
      { integration },
    );
    const { entity: repoB } = await buildIntegrationResource(
      { kind: 'repository', name: 'acme/core-web', status: 'tracked' },
      { integration },
    );
    const { entity: existingLink } = await buildProjectIntegration(
      {},
      { project: existingProject, integration },
    );
    const { entity: existingResLink } = await buildProjectIntegrationResource(
      { projectIntegrationId: existingLink.id, isIdentity: true },
      { project: existingProject, integrationResource: repoA },
    );

    const serializedIntegration = integration.__serialize();
    const serializedProject = existingProject.__serialize() as unknown as ProjectRecord;
    const serializedResources = [repoA.__serialize(), repoB.__serialize()];
    const serializedLinks = [
      {
        ...existingLink.__serialize(),
        project: serializedProject,
        projectIntegrationResources: [existingResLink.__serialize()],
      },
    ];

    fetchSpy = stubFetch(({ method, url }) => {
      if (method === 'GET' && url.includes('/integrationResources')) {
        return jsonResponse({
          data: serializedResources,
          pagination: { total: 2, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'GET' && url.includes('/projectIntegrations')) {
        return jsonResponse({
          data: serializedLinks,
          pagination: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
        });
      }
      if (method === 'POST' && url.includes(`/integration/${integration.id}/projectIntegrations`)) {
        return jsonResponse({ data: serializedLinks }, 201);
      }
      return jsonResponse({ data: [] });
    });

    render(
      <QueryClientProvider client={client}>
        <IntegrationProjectsSetup
          integration={serializedIntegration}
          projects={[serializedProject]}
          resourceSpecs={repoSpecs}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect((screen.getByLabelText('acme/core-api') as HTMLSelectElement).value).toBe(
        existingProject.id,
      );
    });

    // Attach repoB to existingProject -> defaults isIdentity to false since repoA already holds identity
    fireEvent.change(screen.getByLabelText('acme/core-web'), {
      target: { value: existingProject.id },
    });
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0]!.checked).toBe(true);
    expect(checkboxes[1]!.checked).toBe(false);

    // Promoting repoB to identity automatically unchecks repoA
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
});
