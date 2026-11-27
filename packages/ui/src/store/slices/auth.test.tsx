/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { buildUser } from '@template/db/test';
import { contactInfoQueryKey, organizationReadAuthProviderQueryKey } from '@template/sdk';
import { SignUpForm } from '@template/ui/components/auth/SignUpForm';
import { UserMenu } from '@template/ui/components/layout/UserMenu';
import {
  clearToken,
  fetchStoredTokenAndClearIfExpired,
  setToken,
  storedTokenExpiry,
} from '@template/ui/lib/auth/token';
import type { EmailAuthMethod } from '@template/ui/lib/auth/types';
import type { ApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';
import { useAppStore } from '@template/ui/store';
import { createTestStore } from '@template/ui/test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const method: EmailAuthMethod = {
  type: 'email',
  email: 'signup@example.test',
  name: 'Signup Test',
  password: 'test-password',
};
const token = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.c2lnbmF0dXJl';
const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
let requests: Array<{ path: string; authorization: string | null }>;
let respond: (path: string) => Response;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let store: ReturnType<typeof createTestStore>;
let authenticate: ReturnType<typeof mock>;
let socketLogout: ReturnType<typeof mock>;
const initialState = useAppStore.getState();

beforeEach(() => {
  clearToken();
  requests = [];
  respond = () => Response.json({ message: 'Unexpected request' }, { status: 400 });
  const intercept = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url).pathname;
    const headers = new Headers(
      init?.headers ??
        (typeof input === 'object' && 'headers' in input ? input.headers : undefined),
    );
    requests.push({ path, authorization: headers.get('authorization') });
    return respond(path);
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
  authenticate = mock(() => {});
  socketLogout = mock(() => {});
  const websocket = {
    connect: () => {},
    disconnect: () => {},
    authenticate,
    logout: socketLogout,
    spoof: () => {},
    unspoof: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    open: () => {},
    close: () => {},
    resync: () => {},
  } satisfies ApiWebsocket;
  store = createTestStore({ websocket });
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  clearToken();
  useAppStore.setState(initialState);
  store.getState().queryClient?.clear();
});

test('verification-required signup succeeds without a token, hydration or websocket authentication', async () => {
  respond = () => Response.json({ token: null, user: { emailVerified: false } });
  expect(await store.getState().auth.signUp(method)).toEqual({
    status: 'verification-pending',
    email: method.email,
  });
  expect(requests.map((r) => r.path)).toEqual(['/api/auth/sign-up/email']);
  expect(fetchStoredTokenAndClearIfExpired()).toBeNull();
  expect(store.getState().auth.isAuthenticated).toBe(false);
  expect(authenticate).not.toHaveBeenCalled();
});

test('pending signup clears stale local identity without navigation or remote signout', async () => {
  const navigate = mock(() => {});
  setToken(token, new Date(Date.now() + 60_000));
  const { entity } = await buildUser();
  store.setState((state) => ({
    auth: { ...state.auth, user: entity.__serialize(), isAuthenticated: true, spaceUsers: {} },
    navigation: { ...state.navigation, navigate },
  }));
  store.getState().tenant.switchToUserContext();
  respond = () => Response.json({ token: null, user: { emailVerified: false } });
  await store.getState().auth.signUp(method);
  expect(store.getState().auth.user).toBeNull();
  expect(store.getState().auth.isAuthenticated).toBe(false);
  expect(store.getState().auth.spaceUsers).toBeNull();
  expect(store.getState().tenant.context).toEqual({ type: 'public' });
  expect(socketLogout).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
  expect(requests).toHaveLength(1);
});

test.each([
  'signIn',
  'signUp',
] as const)('%s with a JWT hydrates the user with bearer auth', async (action) => {
  const { entity } = await buildUser({ email: method.email, emailVerified: true });
  const user = entity.__serialize();
  respond = (path) =>
    path === '/api/v1/me'
      ? Response.json({
          data: { ...user, organizations: [], organizationUsers: [], spaces: [], spaceUsers: [] },
        })
      : Response.json({ token, expiresAt, user });
  const result = await store.getState().auth[action](method);
  if (action === 'signUp') expect(result).toEqual({ status: 'authenticated' });
  expect(fetchStoredTokenAndClearIfExpired()).toBe(token);
  expect(requests.at(-1)).toEqual({ path: '/api/v1/me', authorization: `Bearer ${token}` });
  expect(store.getState().auth.user?.id).toBe(user.id);
  expect(store.getState().auth.isAuthenticated).toBe(true);
  expect(authenticate).toHaveBeenCalledWith(token);
});

test.each([
  'signIn',
  'signUp',
] as const)('%s errors do not hydrate or authenticate', async (action) => {
  respond = () => Response.json({ message: 'Email verification required' }, { status: 403 });
  await expect(store.getState().auth[action](method)).rejects.toThrow(
    'Email verification required',
  );
  expect(requests).toHaveLength(1);
  expect(fetchStoredTokenAndClearIfExpired()).toBeNull();
  expect(store.getState().auth.isAuthenticated).toBe(false);
  expect(authenticate).not.toHaveBeenCalled();
});

test('a malformed tokenless signup remains an error', async () => {
  respond = () => Response.json({ user: { emailVerified: true } });
  await expect(store.getState().auth.signUp(method)).rejects.toThrow('No token');
  expect(requests).toHaveLength(1);
  expect(fetchStoredTokenAndClearIfExpired()).toBeNull();
});

test('the OAuth callback exchanges its one-time token for the JWT, then hydrates and authenticates', async () => {
  const { entity } = await buildUser({ emailVerified: true });
  const user = entity.__serialize();
  respond = (path) =>
    path === '/api/v1/me'
      ? Response.json({
          data: { ...user, organizations: [], organizationUsers: [], spaces: [], spaceUsers: [] },
        })
      : Response.json({ token, expiresAt, user });
  await store.getState().auth.completeOAuthSignIn('one-time');
  expect(requests.map((r) => r.path)).toEqual(['/api/auth/one-time-token/verify', '/api/v1/me']);
  expect(fetchStoredTokenAndClearIfExpired()).toBe(token);
  expect(storedTokenExpiry()?.toISOString()).toBe(expiresAt);
  expect(store.getState().auth.user?.id).toBe(user.id);
  expect(authenticate).toHaveBeenCalledWith(token);
});

test('a sign-in answer without a JWT handoff stores nothing', async () => {
  respond = () => Response.json({ token, user: { id: 'u1' } });
  await expect(store.getState().auth.signIn(method)).rejects.toThrow('No token');
  expect(fetchStoredTokenAndClearIfExpired()).toBeNull();
});

test('logout drops the JWT locally and calls no server', async () => {
  setToken(token, new Date(Date.now() + 60_000));
  store.setState((state) => ({
    auth: { ...state.auth, isAuthenticated: true, organizations: {}, spaces: {}, spaceUsers: {} },
  }));
  store.getState().tenant.switchToUserContext();
  await store.getState().auth.logout();
  expect(requests).toEqual([]);
  expect(fetchStoredTokenAndClearIfExpired()).toBeNull();
  expect(socketLogout).toHaveBeenCalledTimes(1);
  expect(store.getState().auth.isAuthenticated).toBe(false);
  expect(store.getState().auth.spaceUsers).toBeNull();
  expect(store.getState().tenant.context).toEqual({ type: 'public' });
});

test('signup form displays verification success without navigating to the dashboard', async () => {
  respond = (path) =>
    path === '/api/v1/authProvider'
      ? Response.json({ data: [] })
      : Response.json({ token: null, user: { emailVerified: false } });
  const navigate = mock(() => {}),
    login = mock(() => {});
  useAppStore.setState({
    ...store.getState(),
    navigation: { ...store.getState().navigation, navigateKeepingSearchParams: navigate },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const route = createRootRoute({ component: () => <SignUpForm onLoginClick={login} /> });
  const router = createRouter({
    routeTree: route,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  try {
    await waitFor(() => expect(view.getByLabelText('Name')).toBeDefined());
    fireEvent.change(view.getByLabelText('Name'), { target: { value: method.name } });
    fireEvent.change(view.getByLabelText('Email'), { target: { value: method.email } });
    fireEvent.change(view.getByLabelText('Password'), { target: { value: method.password } });
    fireEvent.submit(view.getByRole('button', { name: 'Create account' }).closest('form')!);
    await waitFor(() => expect(view.getByRole('status').textContent).toContain(method.email));
    expect(view.getByText('Check your email')).toBeDefined();
    expect(view.queryByLabelText('Password')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(requests.some((r) => r.path === '/api/v1/me')).toBe(false);
    fireEvent.click(view.getByRole('button', { name: 'Back to log in' }));
    expect(login).toHaveBeenCalledTimes(1);
  } finally {
    client.clear();
  }
});

test('the logout menu signs out on this device without a server call', async () => {
  setToken(token, new Date(Date.now() + 60_000));
  useAppStore.setState(store.getState());
  const view = render(<UserMenu />);
  fireEvent.click(view.getByRole('button'));
  await waitFor(() => expect(view.getByRole('menuitem', { name: 'Log out' })).toBeDefined());
  fireEvent.click(view.getByRole('menuitem', { name: 'Log out' }));
  await waitFor(() => expect(fetchStoredTokenAndClearIfExpired()).toBeNull());
  expect(socketLogout).toHaveBeenCalledTimes(1);
  expect(requests).toEqual([]);
});

test('logout and setSpoof clear authenticated queries while keeping master data and public queries', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  store.getState().connectQueryClientToWebsocket(client);

  const privateKey = [{ _id: 'organizationReadProtected', path: { id: 'org-1' } }];
  const ownerScopedAuthProviderKey = organizationReadAuthProviderQueryKey({
    path: { id: 'org-1' },
  });
  const masterKey = contactInfoQueryKey();
  const publicMetaKey = ['custom-public'];

  const seedCache = () => {
    client.setQueryData(privateKey, { secret: true });
    client.setQueryData(ownerScopedAuthProviderKey, [{ id: 'ap-disabled', enabled: false }]);
    client.setQueryData(masterKey, { catalog: true });
    client.getQueryCache().build(client, { queryKey: publicMetaKey, meta: { public: true } });
    client.setQueryData(publicMetaKey, { banner: 'ok' });
  };

  seedCache();
  await store.getState().auth.logout();
  expect(client.getQueryData(privateKey)).toBeUndefined();
  expect(client.getQueryData(ownerScopedAuthProviderKey)).toBeUndefined();
  expect(client.getQueryData(masterKey)).toEqual({ catalog: true });
  expect(client.getQueryData(publicMetaKey)).toEqual({ banner: 'ok' });

  const { entity } = await buildUser({ email: 'target@example.test', emailVerified: true });
  const targetUser = entity.__serialize();
  setToken(token, new Date(Date.now() + 60_000));
  respond = () =>
    Response.json({
      data: { ...targetUser, organizations: [], organizationUsers: [], spaces: [], spaceUsers: [] },
    });

  seedCache();
  await store.getState().auth.setSpoof(targetUser.email);
  expect(client.getQueryData(privateKey)).toBeUndefined();
  expect(client.getQueryData(ownerScopedAuthProviderKey)).toBeUndefined();
  expect(client.getQueryData(masterKey)).toEqual({ catalog: true });
  expect(client.getQueryData(publicMetaKey)).toEqual({ banner: 'ok' });
});
