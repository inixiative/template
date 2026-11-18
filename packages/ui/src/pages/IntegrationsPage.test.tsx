/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { buildIntegration, buildOrganization, buildSpace, buildUser } from '@template/db/test';
import { flowReadQueryKeyFor } from '@template/ui/lib/flows/flowReadQueryOptions';
import {
  type IntegrationProvider,
  integrationProviderValues,
} from '@template/ui/lib/integrationProviders';
import {
  type IntegrationConnectFlows,
  IntegrationsPage,
  type ProviderFitsOwner,
} from '@template/ui/pages/IntegrationsPage';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';

const initialState = useAppStore.getState();
const providerSectionCount = integrationProviderValues.length + 1;

type StoredIntegration = Record<string, unknown> & {
  id: string;
  name: string;
  provider: IntegrationProvider | null;
};

type ListRequest = { method: 'GET'; path: string; provider: string | null; page: number };
type ApiRequest = ListRequest | { method: 'POST' | 'DELETE'; path: string; body?: unknown };

let stored: Record<string, StoredIntegration[]>;
let requests: ApiRequest[];
let permissionChecks: Array<{ model: string; id: unknown; action: unknown }>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let owner: Awaited<ReturnType<typeof buildUser>>['entity'];
let observers: Array<{ callback: IntersectionObserverCallback; targets: Set<Element> }>;
let intersectionObserverSpy: ReturnType<typeof spyOn>;

function RecordingIntersectionObserver(callback: IntersectionObserverCallback) {
  const entry = { callback, targets: new Set<Element>() };
  observers.push(entry);
  return {
    observe: (target: Element) => entry.targets.add(target),
    unobserve: (target: Element) => entry.targets.delete(target),
    disconnect: () => entry.targets.clear(),
  };
}

const scrollToEnd = (container: HTMLElement) => {
  // why: an icon's svg is aria-hidden too once its set has loaded, so only the direct child is the sentinel.
  const sentinel = container.querySelector(':scope > div[aria-hidden="true"]');
  for (const { callback, targets } of observers) {
    if (!sentinel || !targets.has(sentinel)) continue;
    act(() =>
      callback(
        [{ isIntersecting: true, target: sentinel } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  }
};

const buildStoredIntegrationRow = async (
  name: string,
  provider: StoredIntegration['provider'],
): Promise<StoredIntegration> => {
  const { entity } = await buildIntegration({
    name,
    provider,
    ownerModel: 'User',
    userId: owner.id,
  });
  return entity.__serialize() as StoredIntegration;
};

const setTenantContextAndStubManagePermission = (
  context: TenantContext,
  canManage: boolean | readonly string[],
) =>
  useAppStore.setState((state) => ({
    tenant: { ...state.tenant, context },
    permissions: {
      ...state.permissions,
      check: (model, record, action) => {
        permissionChecks.push({ model, id: record.id, action });
        const managesModel = typeof canManage === 'boolean' ? canManage : canManage.includes(model);
        return managesModel && action === 'manage';
      },
    },
  }));

type RenderPageOptions = {
  connectFlows?: IntegrationConnectFlows;
  providerFitsOwner?: ProviderFitsOwner;
  entry?: string;
};

const pageElement = ({
  connectFlows,
  providerFitsOwner,
  entry = '/settings/integrations',
}: RenderPageOptions = {}) => (
  <QueryClientProvider client={client}>
    <RouterProvider
      router={createRouter({
        routeTree: createRootRoute({
          component: () => (
            <IntegrationsPage connectFlows={connectFlows} providerFitsOwner={providerFitsOwner} />
          ),
        }),
        history: createMemoryHistory({ initialEntries: [entry] }),
      })}
    />
  </QueryClientProvider>
);

const renderPage = (options: RenderPageOptions = {}) => render(pageElement(options));

const ownerSection = (sectionKey: string) =>
  within(screen.getByTestId(`integrations-section-${sectionKey}`));

const providerCard = (provider: string, scope = within(document.body)) =>
  scope.getByTestId(`provider-${provider}`);

const listRequests = () =>
  requests.filter((request): request is ListRequest => request.method === 'GET');

const waitForEveryProviderListRequest = () =>
  waitFor(() => expect(listRequests().length).toBeGreaterThanOrEqual(providerSectionCount));

const providerFilterOf = (url: URL) =>
  url.searchParams.get('searchFields[provider][equals][:]') === 'null'
    ? null
    : url.searchParams.get('searchFields[provider][equals]');

beforeEach(async () => {
  owner = (await buildUser()).entity;
  stored = {};
  requests = [];
  permissionChecks = [];
  observers = [];
  intersectionObserverSpy = spyOn(globalThis, 'IntersectionObserver').mockImplementation(
    RecordingIntersectionObserver as never,
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && path.endsWith('/integrations')) {
      const provider = providerFilterOf(url);
      const page = Number(url.searchParams.get('page') ?? 1);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 100);
      requests.push({ method: 'GET', path, provider, page });
      const matching = (stored[path] ?? []).filter(
        (integration) => integration.provider === provider,
      );
      return Response.json({
        data: matching.slice((page - 1) * pageSize, page * pageSize),
        pagination: {
          page,
          pageSize,
          total: matching.length,
          totalPages: Math.ceil(matching.length / pageSize),
        },
      });
    }
    if (request.method === 'POST' && path.endsWith('/integrations')) {
      const body = (await request.json()) as {
        name: string;
        provider: IntegrationProvider | null;
      };
      requests.push({ method: 'POST', path, body });
      const integration = await buildStoredIntegrationRow(body.name, body.provider);
      stored[path] = [...(stored[path] ?? []), integration];
      return Response.json({ data: integration }, { status: 201 });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/v1/integration/')) {
      requests.push({ method: 'DELETE', path });
      const id = path.split('/').pop();
      for (const key of Object.keys(stored)) {
        stored[key] = (stored[key] ?? []).filter((integration) => integration.id !== id);
      }
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 400 });
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
  useAppStore.setState((state) => ({
    auth: { ...state.auth, user: owner.__serialize(), isAuthenticated: true },
  }));
  setTenantContextAndStubManagePermission({ type: 'user' }, true);
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  intersectionObserverSpy.mockRestore();
  useAppStore.setState(initialState);
  client.clear();
});

describe('IntegrationsPage', () => {
  it('renders every catalog provider with the status of its own section', async () => {
    stored['/api/v1/me/integrations'] = [await buildStoredIntegrationRow('Engineering', 'github')];
    renderPage();
    await screen.findByText('Engineering');

    for (const label of ['Slack', 'Microsoft Teams', 'Linear', 'Notion', 'GitHub', 'Archive']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(within(providerCard('github')).getByText('Connected')).toBeTruthy();
    expect(await within(providerCard('slack')).findByText('Not connected')).toBeTruthy();
  });

  it('queries one list per provider plus a null-provider list for custom integrations', async () => {
    renderPage();
    await waitForEveryProviderListRequest();

    expect(
      listRequests()
        .map((request) => request.provider)
        .sort(),
    ).toEqual([...integrationProviderValues, null].sort());
  });

  it('marks providers disabled when the actor cannot manage the owner', async () => {
    setTenantContextAndStubManagePermission({ type: 'user' }, false);
    stored['/api/v1/me/integrations'] = [await buildStoredIntegrationRow('Engineering', 'github')];
    renderPage();
    await screen.findByText('Engineering');

    expect(within(providerCard('github')).getByText('Connected')).toBeTruthy();
    expect(await within(providerCard('slack')).findByText('Disabled')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Connect Slack' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Add custom' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Delete Engineering' })).toBeNull();
  });

  it('groups each integration under its provider', async () => {
    stored['/api/v1/me/integrations'] = [
      await buildStoredIntegrationRow('Frontend repo', 'github'),
      await buildStoredIntegrationRow('Backend repo', 'github'),
      await buildStoredIntegrationRow('Team chat', 'slack'),
      await buildStoredIntegrationRow('Legacy', null),
    ];
    renderPage();
    await screen.findByText('Team chat');
    await screen.findByText('Legacy');

    const github = within(providerCard('github'));
    expect(github.getByText('Frontend repo')).toBeTruthy();
    expect(github.getByText('Backend repo')).toBeTruthy();
    expect(github.queryByText('Team chat')).toBeNull();
    expect(within(providerCard('slack')).getByText('Team chat')).toBeTruthy();
    expect(within(providerCard('custom')).getByText('Legacy')).toBeTruthy();
    expect(within(providerCard('linear')).queryByRole('listitem')).toBeNull();
  });

  it('shows a hundred integrations per provider section and scrolls inside the section for more', async () => {
    const repos: StoredIntegration[] = [];
    for (let index = 1; index <= 102; index++) {
      repos.push(
        await buildStoredIntegrationRow(`Repo ${String(index).padStart(3, '0')}`, 'github'),
      );
    }
    stored['/api/v1/me/integrations'] = [
      ...repos,
      await buildStoredIntegrationRow('Team chat', 'slack'),
    ];
    renderPage();
    await screen.findByText('Repo 100', {}, { timeout: 5_000 });

    const github = within(providerCard('github'));
    expect(github.getAllByRole('listitem')).toHaveLength(100);
    expect(github.queryByText('Repo 101')).toBeNull();
    expect(github.getByText('Connected')).toBeTruthy();

    scrollToEnd(screen.getByTestId('integrations-github'));

    await waitFor(() => expect(github.getAllByRole('listitem')).toHaveLength(102), {
      timeout: 5_000,
    });
    expect(
      listRequests()
        .filter((request) => request.provider === 'github')
        .map((request) => request.page),
    ).toEqual([1, 2]);
    expect(listRequests().filter((request) => request.provider === 'slack')).toHaveLength(1);
  });

  it('lists the integrations of the current context, with your personal ones on every tenant page', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    const space = (await buildSpace({ organizationId: organization.id })).entity.__serialize();
    stored['/api/v1/me/integrations'] = [await buildStoredIntegrationRow('My notes', 'notion')];
    stored[`/api/v1/organization/${organization.id}/integrations`] = [
      await buildStoredIntegrationRow('Company', 'notion'),
    ];
    stored[`/api/v1/space/${space.id}/integrations`] = [
      await buildStoredIntegrationRow('Workspace', 'notion'),
    ];

    const view = renderPage();
    await screen.findByText('My notes');
    expect(screen.queryByText('Personal')).toBeNull();

    setTenantContextAndStubManagePermission(
      { type: 'organization', organization } as unknown as TenantContext,
      true,
    );
    view.rerender(pageElement());
    await waitFor(() => expect(ownerSection('tenant').getByText('Company')).toBeTruthy());
    expect(ownerSection('personal').getByText('Personal')).toBeTruthy();
    expect(ownerSection('personal').getByText('My notes')).toBeTruthy();
    expect(ownerSection('tenant').queryByText('My notes')).toBeNull();

    setTenantContextAndStubManagePermission(
      { type: 'space', organization, space } as unknown as TenantContext,
      true,
    );
    view.rerender(pageElement());
    await waitFor(() => expect(ownerSection('tenant').getByText('Workspace')).toBeTruthy());
    expect(screen.queryByText('Company')).toBeNull();
    expect(ownerSection('personal').getByText('My notes')).toBeTruthy();

    expect([...new Set(listRequests().map((request) => request.path))]).toEqual([
      '/api/v1/me/integrations',
      `/api/v1/organization/${organization.id}/integrations`,
      `/api/v1/space/${space.id}/integrations`,
    ]);
    expect(permissionChecks).toContainEqual({ model: 'user', id: owner.id, action: 'manage' });
    expect(permissionChecks).toContainEqual({
      model: 'organization',
      id: organization.id,
      action: 'manage',
    });
    expect(permissionChecks).toContainEqual({ model: 'space', id: space.id, action: 'manage' });
    expect(permissionChecks.every((check) => check.action === 'manage')).toBe(true);
  });

  it("connect opens the provider's create flow and lists the new integration under it", async () => {
    renderPage();
    await waitForEveryProviderListRequest();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Slack' }));
    await screen.findByText('Connect Slack');
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Support workspace' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(within(providerCard('slack')).getByText('Support workspace')).toBeTruthy(),
    );
    expect(requests.find((request) => request.method === 'POST')).toEqual({
      method: 'POST',
      path: '/api/v1/me/integrations',
      body: { name: 'Support workspace', provider: 'slack' },
    });
    await waitFor(() => expect(within(providerCard('slack')).getByText('Connected')).toBeTruthy());
  });

  it('always shows the Custom card, and Add custom creates an integration without a provider', async () => {
    renderPage();
    await waitForEveryProviderListRequest();

    const custom = within(providerCard('custom'));
    expect(custom.getByText('Custom')).toBeTruthy();
    expect(custom.queryByRole('listitem')).toBeNull();

    fireEvent.click(custom.getByRole('button', { name: 'Add custom' }));
    await screen.findByText('Add custom integration');
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Internal webhook' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(within(providerCard('custom')).getByText('Internal webhook')).toBeTruthy(),
    );
    expect(requests.find((request) => request.method === 'POST')).toEqual({
      method: 'POST',
      path: '/api/v1/me/integrations',
      body: { name: 'Internal webhook', provider: null },
    });
  });

  it("a provider's own connect flow replaces the generic one and refreshes the list", async () => {
    renderPage({
      connectFlows: {
        github: ({ onConnected }) => (
          <button type="button" onClick={onConnected}>
            Finish GitHub
          </button>
        ),
      },
    });
    await waitForEveryProviderListRequest();

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(screen.queryByLabelText('Integration name')).toBeNull();
    stored['/api/v1/me/integrations'] = [await buildStoredIntegrationRow('Platform', 'github')];
    fireEvent.click(screen.getByRole('button', { name: 'Finish GitHub' }));

    await waitFor(() => expect(within(providerCard('github')).getByText('Platform')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Finish GitHub' })).toBeNull();
  });

  it('connects through the organization when the context is an organization', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    setTenantContextAndStubManagePermission(
      { type: 'organization', organization } as unknown as TenantContext,
      true,
    );
    renderPage();
    await waitForEveryProviderListRequest();

    fireEvent.click(ownerSection('tenant').getByRole('button', { name: 'Connect Linear' }));
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Product' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(
        within(providerCard('linear', ownerSection('tenant'))).getByText('Product'),
      ).toBeTruthy(),
    );
    expect(requests.find((request) => request.method === 'POST')?.path).toBe(
      `/api/v1/organization/${organization.id}/integrations`,
    );
  });

  it('deletes an integration from under its provider', async () => {
    stored['/api/v1/me/integrations'] = [await buildStoredIntegrationRow('Old chat', 'slack')];
    renderPage();
    await screen.findByText('Old chat');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Old chat' }));

    await waitForElementToBeRemoved(() => screen.queryByText('Old chat'));
    await waitFor(() =>
      expect(within(providerCard('slack')).getByText('Not connected')).toBeTruthy(),
    );
    const deleted = requests.filter((request) => request.method === 'DELETE');
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.path).toMatch(/^\/api\/v1\/integration\//);
  });

  it('opens a connect section from its link', async () => {
    renderPage({ entry: '/settings/integrations#connect-slack' });
    fireEvent.change(await screen.findByLabelText('Integration name'), {
      target: { value: 'Linked' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')).toEqual({
        method: 'POST',
        path: '/api/v1/me/integrations',
        body: { name: 'Linked', provider: 'slack' },
      }),
    );
  });

  it('gives each owner section on a tenant page its own connect links', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    setTenantContextAndStubManagePermission(
      { type: 'organization', organization } as unknown as TenantContext,
      true,
    );
    renderPage({ entry: '/settings/integrations#personal-connect-linear' });
    await screen.findByLabelText('Integration name');
    fireEvent.change(screen.getByLabelText('Integration name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.path).toBe(
        '/api/v1/me/integrations',
      ),
    );
  });

  it('offers only the providers that fit the owner each section is for', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    setTenantContextAndStubManagePermission(
      { type: 'organization', organization } as unknown as TenantContext,
      true,
    );
    renderPage({
      providerFitsOwner: (provider, ownerModel) =>
        provider !== 'slack' || ownerModel === 'Organization',
    });
    await waitFor(() => expect(ownerSection('tenant').getByTestId('provider-slack')).toBeTruthy());
    expect(ownerSection('personal').queryByTestId('provider-slack')).toBeNull();
    expect(ownerSection('personal').getByTestId('provider-linear')).toBeTruthy();
  });

  it('rechecks the active flow once a connect flow finishes', async () => {
    useAppStore.getState().navigation.setFlowId('flow-1');
    const invalidate = spyOn(client, 'invalidateQueries');
    renderPage({
      connectFlows: {
        github: ({ onConnected }) => (
          <button type="button" onClick={onConnected}>
            Finish GitHub
          </button>
        ),
      },
    });
    await waitForEveryProviderListRequest();

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish GitHub' }));

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: flowReadQueryKeyFor('flow-1') }),
    );
  });

  it('keeps your personal integrations manageable on a tenant page you cannot manage', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    setTenantContextAndStubManagePermission(
      { type: 'organization', organization } as unknown as TenantContext,
      ['user'],
    );
    renderPage();
    await waitForEveryProviderListRequest();

    await waitFor(() =>
      expect(
        ownerSection('personal')
          .getByRole('button', { name: 'Connect Slack' })
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    expect(
      ownerSection('tenant')
        .getByRole('button', { name: 'Connect Slack' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('connects through your membership from its own link, and through the tenant from the plain one', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    const membershipId = '0195f7a2-0000-7000-8000-00000000a001';
    useAppStore.setState((state) => ({
      auth: {
        ...state.auth,
        organizationUsers: {
          [organization.id]: {
            id: membershipId,
            organizationId: organization.id,
            userId: owner.id,
          },
        } as unknown as typeof state.auth.organizationUsers,
      },
    }));
    setTenantContextAndStubManagePermission(
      { type: 'organization', organization } as unknown as TenantContext,
      true,
    );
    const seenOwnerModels = new Set<string>();
    const view = renderPage({
      entry: '/settings/integrations#member-connect-linear',
      providerFitsOwner: (_provider, ownerModel) => {
        seenOwnerModels.add(ownerModel);
        return true;
      },
    });
    await waitFor(() =>
      expect(ownerSection('member').getByText(`Yours in ${organization.name}`)).toBeTruthy(),
    );
    fireEvent.change(await screen.findByLabelText('Integration name'), {
      target: { value: 'Mine here' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.path).toBe(
        `/api/v1/organizationUser/${membershipId}/integrations`,
      ),
    );
    expect([...seenOwnerModels].sort()).toEqual(['Organization', 'OrganizationUser', 'User']);

    view.unmount();
    requests.length = 0;
    renderPage({ entry: '/settings/integrations#connect-linear' });
    fireEvent.change(await screen.findByLabelText('Integration name'), {
      target: { value: 'Team' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.path).toBe(
        `/api/v1/organization/${organization.id}/integrations`,
      ),
    );
  });
});
