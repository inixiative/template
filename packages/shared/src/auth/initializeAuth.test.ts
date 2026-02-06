import { describe, it, expect, beforeEach } from 'bun:test';
import { initializeAuth } from './initializeAuth';
import { useAppStore } from '../store';
import { QueryClient } from '@tanstack/react-query';
import { buildUser } from '@template/db/test';
import '../test/setup';

describe('initializeAuth', () => {
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
        hydrate: (data) => {
          useAppStore.setState((state) => ({
            auth: {
              ...state.auth,
              ...data,
              isAuthenticated: !!data.user,
              isInitialized: true,
            },
          }));
        },
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

  it('should fetch user data and hydrate store', async () => {
    await initializeAuth();

    const store = useAppStore.getState();
    expect(store.auth.user).not.toBeNull();
    expect(store.auth.isAuthenticated).toBe(true);
    expect(store.auth.isInitialized).toBe(true);
  });

  it('should throw error if /me returns no data', async () => {
    const { server } = await import('../test/mocks/server');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get('*/api/v1/me', () => {
        return HttpResponse.json({ data: null });
      })
    );

    await expect(initializeAuth()).rejects.toThrow('No user data returned');
  });
});
