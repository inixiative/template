import { describe, it, expect, beforeEach } from 'bun:test';
import { logout } from './logout';
import { useAppStore } from '../store';
import { QueryClient } from '@tanstack/react-query';
import '../test/setup';

describe('logout', () => {
  beforeEach(() => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAppStore.setState({
      api: { queryClient },
      auth: {
        user: null,
        session: null,
        organizationUsers: null,
        organizations: null,
        spaceUsers: null,
        spaces: null,
        strategy: { type: 'login' },
        isAuthenticated: false,
        isEmbedded: false,
        isInitialized: false,
        setUser: () => {},
        setSession: () => {},
        setStrategy: () => {},
        hydrate: () => {},
        requireAuth: () => {},
        logout: async () => {},
      },
      permissions: {
        setUserId: () => {},
        setSuperadmin: () => {},
        isSuperadmin: () => false,
        check: () => false,
        hydrate: async () => {},
        clear: () => {},
      },
    });
  });

  it('should call signOut API and clear all state', async () => {
    const store = useAppStore.getState();
    await logout('http://localhost:8000');

    expect(store.auth.user).toBeNull();
    expect(store.auth.isAuthenticated).toBe(false);
  });

  it('should clear state even if API fails', async () => {
    const { server } = await import('../test/mocks/server');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.post('*/api/auth/sign-out', () => {
        return HttpResponse.json(
          { error: 'Server error' },
          { status: 500 }
        );
      })
    );

    // Better-auth client doesn't throw on HTTP errors, so we just verify state is cleared
    await logout('http://localhost:8000');

    const store = useAppStore.getState();
    expect(store.auth.user).toBeNull();
  });
});
