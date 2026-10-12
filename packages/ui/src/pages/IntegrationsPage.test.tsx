/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildIntegration, buildOrganization, buildSpace, buildUser } from '@template/db/test';
import {
  type IntegrationProvider,
  integrationProviderValues,
} from '@template/ui/lib/integrationProviders';
import { IntegrationsPage } from '@template/ui/pages/IntegrationsPage';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const initialState = useAppStore.getState();
const bucketCount = integrationProviderValues.length + 1;

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
  const sentinel = container.querySelector('[aria-hidden="true"]:last-of-type');
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

const serverIntegration = async (
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

const setContext = (context: TenantContext, canManage: boolean) =>
  useAppStore.setState((state) => ({
    tenant: { ...state.tenant, context },
    permissions: {
      ...state.permissions,
      check: (model, record, action) => {
        permissionChecks.push({ model, id: record.id, action });
        return canManage && action === 'manage';
      },
    },
  }));

const renderPage = () =>
  render(
    <QueryClientProvider client={client}>
      <IntegrationsPage />
    </QueryClientProvider>,
  );

const providerCard = (provider: string) => screen.getByTestId(`provider-${provider}`);

const listRequests = () =>
  requests.filter((request): request is ListRequest => request.method === 'GET');

const waitForBuckets = () =>
  waitFor(() => expect(listRequests().length).toBeGreaterThanOrEqual(bucketCount));

const readProviderFilter = (url: URL) =>
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
      const provider = readProviderFilter(url);
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
      const integration = await serverIntegration(body.name, body.provider);
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
  setContext({ type: 'user' }, true);
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  intersectionObserverSpy.mockRestore();
  useAppStore.setState(initialState);
  client.clear();
});

describe('IntegrationsPage', () => {
  it('renders every catalog provider with the status of its own bucket', async () => {
    stored['/api/v1/me/integrations'] = [await serverIntegration('Engineering', 'github')];
    renderPage();
    await screen.findByText('Engineering');

    for (const label of ['Slack', 'Microsoft Teams', 'Linear', 'Notion', 'GitHub', 'Archive']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(within(providerCard('github')).getByText('Connected')).toBeTruthy();
    expect(await within(providerCard('slack')).findByText('Not connected')).toBeTruthy();
  });

  it('queries one bucket per provider plus a null-provider bucket for custom integrations', async () => {
    renderPage();
    await waitForBuckets();

    expect(
      listRequests()
        .map((request) => request.provider)
        .sort(),
    ).toEqual([...integrationProviderValues, null].sort());
  });

  it('marks providers disabled when the actor cannot manage the owner', async () => {
    setContext({ type: 'user' }, false);
    stored['/api/v1/me/integrations'] = [await serverIntegration('Engineering', 'github')];
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
      await serverIntegration('Frontend repo', 'github'),
      await serverIntegration('Backend repo', 'github'),
      await serverIntegration('Team chat', 'slack'),
      await serverIntegration('Legacy', null),
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

  it('shows a hundred integrations per bucket and scrolls inside the bucket for more', async () => {
    const repos: StoredIntegration[] = [];
    for (let index = 1; index <= 102; index++) {
      repos.push(await serverIntegration(`Repo ${String(index).padStart(3, '0')}`, 'github'));
    }
    stored['/api/v1/me/integrations'] = [...repos, await serverIntegration('Team chat', 'slack')];
    renderPage();
    await screen.findByText('Repo 100');

    const github = within(providerCard('github'));
    expect(github.getAllByRole('listitem')).toHaveLength(100);
    expect(github.queryByText('Repo 101')).toBeNull();
    expect(github.getByText('Connected')).toBeTruthy();

    scrollToEnd(screen.getByTestId('integrations-github'));

    await waitFor(() => expect(github.getAllByRole('listitem')).toHaveLength(102));
    expect(
      listRequests()
        .filter((request) => request.provider === 'github')
        .map((request) => request.page),
    ).toEqual([1, 2]);
    expect(listRequests().filter((request) => request.provider === 'slack')).toHaveLength(1);
  });

  it('lists the integrations of the current context: me, organization or space', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    const space = (await buildSpace({ organizationId: organization.id })).entity.__serialize();
    stored['/api/v1/me/integrations'] = [await serverIntegration('Personal', 'notion')];
    stored[`/api/v1/organization/${organization.id}/integrations`] = [
      await serverIntegration('Company', 'notion'),
    ];
    stored[`/api/v1/space/${space.id}/integrations`] = [
      await serverIntegration('Workspace', 'notion'),
    ];

    const view = renderPage();
    await screen.findByText('Personal');

    setContext({ type: 'organization', organization } as unknown as TenantContext, true);
    view.rerender(
      <QueryClientProvider client={client}>
        <IntegrationsPage />
      </QueryClientProvider>,
    );
    await screen.findByText('Company');
    expect(screen.queryByText('Personal')).toBeNull();

    setContext({ type: 'space', organization, space } as unknown as TenantContext, true);
    view.rerender(
      <QueryClientProvider client={client}>
        <IntegrationsPage />
      </QueryClientProvider>,
    );
    await screen.findByText('Workspace');
    expect(screen.queryByText('Company')).toBeNull();

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
    await waitForBuckets();

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
    await waitForBuckets();

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
    render(
      <QueryClientProvider client={client}>
        <IntegrationsPage
          connectFlows={{
            github: ({ onConnected }) => (
              <button type="button" onClick={onConnected}>
                Finish GitHub
              </button>
            ),
          }}
        />
      </QueryClientProvider>,
    );
    await waitForBuckets();

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(screen.queryByLabelText('Integration name')).toBeNull();
    stored['/api/v1/me/integrations'] = [await serverIntegration('Platform', 'github')];
    fireEvent.click(screen.getByRole('button', { name: 'Finish GitHub' }));

    await waitFor(() => expect(within(providerCard('github')).getByText('Platform')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Finish GitHub' })).toBeNull();
  });

  it('connects through the organization when the context is an organization', async () => {
    const organization = (await buildOrganization()).entity.__serialize();
    setContext({ type: 'organization', organization } as unknown as TenantContext, true);
    renderPage();
    await waitForBuckets();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Linear' }));
    fireEvent.change(screen.getByLabelText('Integration name'), {
      target: { value: 'Product' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(within(providerCard('linear')).getByText('Product')).toBeTruthy());
    expect(requests.find((request) => request.method === 'POST')?.path).toBe(
      `/api/v1/organization/${organization.id}/integrations`,
    );
  });

  it('deletes an integration from under its provider', async () => {
    stored['/api/v1/me/integrations'] = [await serverIntegration('Old chat', 'slack')];
    renderPage();
    await screen.findByText('Old chat');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Old chat' }));

    await waitFor(() => expect(screen.queryByText('Old chat')).toBeNull());
    await waitFor(() =>
      expect(within(providerCard('slack')).getByText('Not connected')).toBeTruthy(),
    );
    const deleted = requests.filter((request) => request.method === 'DELETE');
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.path).toMatch(/^\/api\/v1\/integration\//);
  });
});
