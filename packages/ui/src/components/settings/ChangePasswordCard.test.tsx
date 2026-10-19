/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { ChangePasswordCard } from '@template/ui/components/settings/ChangePasswordCard';
import { clearToken, getToken, setToken } from '@template/ui/lib/auth/token';
import type { ApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';
import { useAppStore } from '@template/ui/store';
import { createTestStore } from '@template/ui/test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

type Recorded = {
  method: string;
  path: string;
  authorization: string | null;
  credentials: RequestCredentials | undefined;
  body: Record<string, unknown> | null;
};

const oldToken = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJvbGQifQ.b2xk';
const newToken = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJuZXcifQ.bmV3';
const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
const initialState = useAppStore.getState();

let requests: Recorded[];
let respond: (path: string) => Response;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let authenticate: ReturnType<typeof mock>;

beforeEach(() => {
  clearToken();
  setToken(oldToken, new Date(Date.now() + 60_000));
  requests = [];
  respond = () => Response.json({ message: 'Unexpected request' }, { status: 500 });
  const intercept = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const text = await request.clone().text();
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      authorization: request.headers.get('authorization'),
      credentials: init?.credentials,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    });
    return respond(new URL(request.url).pathname);
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
  authenticate = mock(() => {});
  const websocket = {
    connect: () => {},
    authenticate,
    logout: () => {},
    spoof: () => {},
    unspoof: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    open: () => {},
    close: () => {},
    resync: () => {},
  } satisfies ApiWebsocket;
  const store = createTestStore({ websocket });
  store.setState((state) => ({ auth: { ...state.auth, isAuthenticated: true } }));
  useAppStore.setState(store.getState());
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  clearToken();
  useAppStore.setState(initialState);
});

const submit = (view: ReturnType<typeof render>, current: string, next: string, confirm = next) => {
  fireEvent.change(view.getByLabelText('Current password'), { target: { value: current } });
  fireEvent.change(view.getByLabelText('New password'), { target: { value: next } });
  fireEvent.change(view.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.submit(view.getByRole('button', { name: 'Change password' }).closest('form')!);
};

describe('ChangePasswordCard', () => {
  test('changes the password with the JWT and keeps the new one', async () => {
    respond = () => Response.json({ data: { token: newToken, expiresAt } });
    const view = render(<ChangePasswordCard />);
    submit(view, 'current-password', 'brand-new-password');

    await waitFor(() => expect(getToken()).toBe(newToken));
    expect(requests.map(({ credentials: _credentials, ...request }) => request)).toEqual([
      {
        method: 'POST',
        path: '/api/v1/me/changePassword',
        authorization: `Bearer ${oldToken}`,
        body: { currentPassword: 'current-password', newPassword: 'brand-new-password' },
      },
    ]);
    expect(requests[0]?.credentials).not.toBe('include');
    expect(authenticate).toHaveBeenCalledWith(newToken);
    await waitFor(() => expect(view.getByRole('status').textContent).toContain('Password changed'));
    expect((view.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
  });

  test('a confirmation that does not match calls no server', async () => {
    const view = render(<ChangePasswordCard />);
    submit(view, 'current-password', 'brand-new-password', 'something-else');
    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('do not match'));
    expect(requests).toEqual([]);
    expect(getToken()).toBe(oldToken);
  });

  test('a refused change shows the server message and keeps the old JWT', async () => {
    respond = () =>
      Response.json({ error: 'Bad Request', message: 'Invalid password' }, { status: 400 });
    const view = render(<ChangePasswordCard />);
    submit(view, 'wrong-password', 'brand-new-password');
    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('Invalid password'));
    expect(getToken()).toBe(oldToken);
    expect(authenticate).not.toHaveBeenCalled();
  });

  test('is hidden while spoofing another user', () => {
    useAppStore.setState((state) => ({
      auth: { ...state.auth, spoofUserEmail: 'someone@example.test' },
    }));
    const view = render(<ChangePasswordCard />);
    expect(view.queryByLabelText('Current password')).toBeNull();
  });
});
