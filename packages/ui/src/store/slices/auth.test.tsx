/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { buildUser } from '@template/db/test';
import { SignupForm } from '@template/ui/components/auth/SignupForm';
import { UserMenu } from '@template/ui/components/layout/UserMenu';
import { clearToken, getToken, setToken } from '@template/ui/lib/auth/token';
import type { EmailAuthMethod } from '@template/ui/lib/auth/types';
import { toast } from '@template/ui/lib/toast';
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
const token = 'synthetic-session-token';
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
      init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined),
    );
    requests.push({ path, authorization: headers.get('authorization') });
    return respond(path);
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(intercept, { preconnect: fetch.preconnect }));
  authenticate = mock(() => {});
  socketLogout = mock(() => {});
  const websocket = {
    connect: () => {},
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
  store.getState().client?.clear();
});

test('verification-required signup succeeds without a token, hydration or websocket authentication', async () => {
  respond = () => Response.json({ token: null, user: { emailVerified: false } });
  expect(await store.getState().auth.signUp(method)).toEqual({ status: 'verification-pending', email: method.email });
  expect(requests.map((r) => r.path)).toEqual(['/api/auth/sign-up/email']);
  expect(getToken()).toBeNull();
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
  store.getState().tenant.setUser();
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
] as const)('%s with a session token hydrates the user with bearer auth', async (action) => {
  const { entity } = await buildUser({ email: method.email, emailVerified: true });
  const user = entity.__serialize();
  respond = (path) =>
    path === '/api/v1/me'
      ? Response.json({ data: { ...user, organizations: [], organizationUsers: [], spaces: [], spaceUsers: [] } })
      : Response.json({ token, user });
  const result = await store.getState().auth[action](method);
  if (action === 'signUp') expect(result).toEqual({ status: 'authenticated' });
  expect(getToken()).toBe(token);
  expect(requests.at(-1)).toEqual({ path: '/api/v1/me', authorization: `Bearer ${token}` });
  expect(store.getState().auth.user?.id).toBe(user.id);
  expect(store.getState().auth.isAuthenticated).toBe(true);
  expect(authenticate).toHaveBeenCalledWith(token);
});

test.each(['signIn', 'signUp'] as const)('%s errors do not hydrate or authenticate', async (action) => {
  respond = () => Response.json({ message: 'Email verification required' }, { status: 403 });
  await expect(store.getState().auth[action](method)).rejects.toThrow('Email verification required');
  expect(requests).toHaveLength(1);
  expect(getToken()).toBeNull();
  expect(store.getState().auth.isAuthenticated).toBe(false);
  expect(authenticate).not.toHaveBeenCalled();
});

test('a malformed tokenless signup remains an error', async () => {
  respond = () => Response.json({ user: { emailVerified: true } });
  await expect(store.getState().auth.signUp(method)).rejects.toThrow('No token');
  expect(requests).toHaveLength(1);
  expect(getToken()).toBeNull();
});

test.each([200, 403])('logout sends the bearer session and clears local access on HTTP %i', async (status) => {
  setToken(token, new Date(Date.now() + 60_000));
  store.setState((state) => ({
    auth: { ...state.auth, isAuthenticated: true, organizations: {}, spaces: {}, spaceUsers: {} },
  }));
  store.getState().tenant.setUser();
  respond = () => Response.json(status === 200 ? { success: true } : { message: 'Revocation failed' }, { status });
  const pending = store.getState().auth.logout();
  if (status === 200) await pending;
  else await expect(pending).rejects.toThrow('Revocation failed');
  expect(requests).toEqual([{ path: '/api/auth/sign-out', authorization: `Bearer ${token}` }]);
  expect(getToken()).toBeNull();
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
    navigation: { ...store.getState().navigation, navigatePreserving: navigate },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const route = createRootRoute({ component: () => <SignupForm onLoginClick={login} /> });
  const router = createRouter({ routeTree: route, history: createMemoryHistory({ initialEntries: ['/'] }) });
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

test('logout menu reports remote revocation failure after clearing local access', async () => {
  setToken(token, new Date(Date.now() + 60_000));
  useAppStore.setState(store.getState());
  respond = () => Response.json({ message: 'Revocation failed' }, { status: 403 });
  const errorToast = spyOn(toast, 'error').mockImplementation(() => 'test-toast');
  const view = render(<UserMenu />);
  try {
    fireEvent.click(view.getByRole('button'));
    await waitFor(() => expect(view.getByRole('menuitem', { name: 'Log out' })).toBeDefined());
    fireEvent.click(view.getByRole('menuitem', { name: 'Log out' }));
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(
        'Signed out on this device, but the server session could not be revoked.',
      ),
    );
    expect(getToken()).toBeNull();
    expect(socketLogout).toHaveBeenCalledTimes(1);
  } finally {
    errorToast.mockRestore();
  }
});
