/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildToken, buildUser } from '@template/db/test';
import { meReadManyTokensQueryKey } from '@template/sdk';
import { TokensPage } from '@template/ui/pages/TokensPage';
import { useAppStore } from '@template/ui/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const KEY = 'tmpl_once_only_secret';
const initialState = useAppStore.getState();

type StoredToken = Record<string, unknown> & { id: string; name: string };

let stored: StoredToken[];
let requests: Array<{ method: string; path: string }>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let owner: Awaited<ReturnType<typeof buildUser>>['entity'];

const serverToken = async (name: string): Promise<StoredToken> => {
  const { entity } = await buildToken({ name, ownerModel: 'User' }, { user: owner });
  const { keyHash: _keyHash, ...token } = entity.__serialize() as StoredToken;
  return { ...token, lastUsedAt: null };
};

const renderPage = () =>
  render(
    <QueryClientProvider client={client}>
      <TokensPage />
    </QueryClientProvider>,
  );

beforeEach(async () => {
  owner = (await buildUser()).entity;
  stored = [];
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    requests.push({ method: request.method, path });
    if (request.method === 'GET' && path === '/api/v1/me/tokens') {
      return Response.json({ data: stored });
    }
    if (request.method === 'POST' && path === '/api/v1/me/tokens') {
      const { name } = (await request.json()) as { name: string };
      const token = await serverToken(name);
      stored.push(token);
      return Response.json({ data: { ...token, key: KEY } }, { status: 201 });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/v1/token/')) {
      const id = path.split('/').pop();
      stored = stored.filter((token) => token.id !== id);
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 400 });
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
  useAppStore.setState((state) => ({
    auth: { ...state.auth, user: owner.__serialize(), isAuthenticated: true },
    tenant: { ...state.tenant, context: { type: 'user' } },
  }));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.setState(initialState);
  client.clear();
});

describe('TokensPage', () => {
  it('shows a new key once, until the user dismisses it, and keeps it out of the list', async () => {
    renderPage();
    await screen.findByText('No API tokens created yet');

    fireEvent.click(screen.getAllByRole('button', { name: /Create token/i })[0]);
    fireEvent.change(screen.getByLabelText('Token Name'), { target: { value: 'CI deploy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Token' }));

    await screen.findByText('This will never be shown again.');
    expect((screen.getByLabelText('API token') as HTMLInputElement).value).toBe(KEY);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Close modal' })[0]);
    expect(screen.getByText('This will never be shown again.')).toBeTruthy();

    await screen.findByText('CI deploy');
    expect(screen.queryByText('Invalid Date')).toBeNull();
    await waitFor(() =>
      expect(JSON.stringify(client.getQueryData(meReadManyTokensQueryKey()))).not.toContain(KEY),
    );
    expect(JSON.stringify(client.getQueryData(meReadManyTokensQueryKey()))).not.toContain(
      '__optimistic__',
    );

    fireEvent.click(screen.getByRole('button', { name: "I've saved it" }));
    expect(screen.queryByText('This will never be shown again.')).toBeNull();
    expect(screen.queryByText(KEY)).toBeNull();
  });

  it('a delete answered with 204 removes the row and settles without an error', async () => {
    stored = [await serverToken('Old token')];
    renderPage();
    await screen.findByText('Old token');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Old token' }));

    await waitFor(() => expect(screen.queryByText('Old token')).toBeNull());
    await waitFor(() =>
      expect(
        client
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state.status),
      ).toEqual(['success']),
    );
    expect(requests.filter((request) => request.method === 'DELETE')).toHaveLength(1);
  });
});
