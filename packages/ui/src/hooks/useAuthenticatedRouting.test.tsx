/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import { useAuthenticatedRouting } from '@template/ui/hooks/useAuthenticatedRouting';
import { useRegisterNavigation } from '@template/ui/hooks/useRegisterNavigation';
import { createAppQueryClient } from '@template/ui/lib/createAppQueryClient';
import { useAppStore } from '@template/ui/store';
import { act, cleanup, render, waitFor } from '@testing-library/react';

const ORG = '01a12b8e-1111-7000-8000-000000000001';
const OTHER_ORG = '01a12b8e-1111-7000-8000-000000000002';

const dashboard = [{ label: 'Dashboard', path: '/dashboard' }];
const navConfig: NavConfig = {
  user: dashboard,
  organization: dashboard,
  space: dashboard,
  public: dashboard,
};

const initialState = useAppStore.getState();

const Root = () => {
  useRegisterNavigation(navConfig);
  useAuthenticatedRouting();
  return null;
};

const renderAt = (entry: string) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: Root }),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(
    <QueryClientProvider client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

const context = () => useAppStore.getState().tenant.context;
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

beforeEach(() => {
  useAppStore.setState((state) => ({
    auth: {
      ...state.auth,
      isAuthenticated: true,
      organizations: {
        [ORG]: { id: ORG, name: 'Acme' },
        [OTHER_ORG]: { id: OTHER_ORG, name: 'Globex' },
      } as never,
    },
  }));
});

afterEach(() => {
  cleanup();
  useAppStore.setState(initialState);
});

describe('switching context from the picker', () => {
  it('switches from an organization back to personal, and the URL drops ?org', async () => {
    const router = renderAt(`/dashboard?org=${ORG}`);
    await waitFor(() => expect(context().organization?.id).toBe(ORG));

    act(() => useAppStore.getState().tenant.setUser());
    await settle();

    expect(context().type).toBe('user');
    expect(router.state.location.search).not.toHaveProperty('org');
  });

  it('switches from one organization to another, and the URL follows', async () => {
    const router = renderAt(`/dashboard?org=${ORG}`);
    await waitFor(() => expect(context().organization?.id).toBe(ORG));

    act(() => {
      useAppStore.getState().tenant.setOrganization(OTHER_ORG);
    });
    await settle();

    expect(context().organization?.id).toBe(OTHER_ORG);
    expect(router.state.location.search).toMatchObject({ org: OTHER_ORG });
  });

  it('applies ?org from the link once the organizations load', async () => {
    const organizations = useAppStore.getState().auth.organizations;
    useAppStore.setState((state) => ({ auth: { ...state.auth, organizations: {} } }));
    renderAt(`/dashboard?org=${ORG}`);
    await settle();
    expect(context().organization).toBeUndefined();

    act(() => {
      useAppStore.setState((state) => ({ auth: { ...state.auth, organizations } }));
    });

    await waitFor(() => expect(context().organization?.id).toBe(ORG));
  });
});
