/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildIntegration, buildOrganization, buildSpace, buildUser } from '@template/db/test';
import type { IntegrationProvider } from '@template/ui/lib/integrationProviders';
import { IntegrationsPage } from '@template/ui/pages/IntegrationsPage';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const initialState = useAppStore.getState();

type StoredIntegration = Record<string, unknown> & {
  id: string;
  name: string;
  provider: IntegrationProvider | null;
};

let stored: Record<string, StoredIntegration[]>;
let requests: Array<{ method: string; path: string; body?: unknown }>;
let permissionChecks: Array<{ model: string; id: unknown; action: unknown }>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let owner: Awaited<ReturnType<typeof buildUser>>['entity'];

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

beforeEach(async () => {
  owner = (await buildUser()).entity;
  stored = {};
  requests = [];
  permissionChecks = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path.endsWith('/integrations')) {
      requests.push({ method: 'GET', path });
      return Response.json({ data: stored[path] ?? [] });
    }
    if (request.method === 'POST' && path.endsWith('/integrations')) {
      const body = (await request.json()) as { name: string; provider: IntegrationProvider };
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
  useAppStore.setState(initialState);
  client.clear();
});

describe('IntegrationsPage', () => {
  it('renders every catalog provider with its status for the owner', async () => {
    stored['/api/v1/me/integrations'] = [await serverIntegration('Engineering', 'github')];
    renderPage();
    await screen.findByText('Engineering');

    for (const label of ['Slack', 'Microsoft Teams', 'Linear', 'Notion', 'GitHub', 'Archive']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(within(providerCard('github')).getByText('Connected')).toBeTruthy();
    expect(within(providerCard('slack')).getByText('Not connected')).toBeTruthy();
  });

  it('marks providers disabled when the actor cannot manage the owner', async () => {
    setContext({ type: 'user' }, false);
    stored['/api/v1/me/integrations'] = [await serverIntegration('Engineering', 'github')];
    renderPage();
    await screen.findByText('Engineering');

    expect(within(providerCard('github')).getByText('Connected')).toBeTruthy();
    expect(within(providerCard('slack')).getByText('Disabled')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Connect Slack' }) as HTMLButtonElement).disabled,
    ).toBe(true);
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

    const github = within(providerCard('github'));
    expect(github.getByText('Frontend repo')).toBeTruthy();
    expect(github.getByText('Backend repo')).toBeTruthy();
    expect(github.queryByText('Team chat')).toBeNull();
    expect(within(providerCard('slack')).getByText('Team chat')).toBeTruthy();
    expect(within(providerCard('none')).getByText('Legacy')).toBeTruthy();
    expect(within(providerCard('linear')).queryByRole('listitem')).toBeNull();
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

    expect(requests.map((request) => request.path)).toEqual([
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
    await waitFor(() => expect(requests).toHaveLength(1));

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
    await waitFor(() => expect(requests).toHaveLength(1));

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
    await waitFor(() => expect(requests).toHaveLength(1));

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
