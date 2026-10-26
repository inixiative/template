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
import type { Role } from '@template/db/generated/client/enums';
import { buildUser } from '@template/db/test';
import { OrganizationUsersPage } from '@template/ui/pages/OrganizationUsersPage';
import { useAppStore } from '@template/ui/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const initialState = useAppStore.getState();
const organizationId = '01a17900-0000-7000-8000-000000000001';
const memberRowId = '01a17900-0000-7000-8000-000000000002';

let deleted: string[];
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;

const signInAs = async (role: Role) => {
  const { entity } = await buildUser();
  const me = {
    ...entity.__serialize(),
    organizationUsers: [{ id: 'mine', organizationId, userId: entity.id, role }],
    organizations: [],
    spaceUsers: [],
    spaces: [],
  } as unknown as Parameters<ReturnType<typeof useAppStore.getState>['permissions']['setup']>[0];
  useAppStore.getState().permissions.clear();
  await useAppStore.getState().permissions.setup(me);
};

beforeEach(async () => {
  deleted = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { entity: member } = await buildUser({ name: 'Mallory Member' });
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === `/api/v1/organization/${organizationId}/users`)
      return Response.json({
        data: [
          {
            ...member.__serialize(),
            organizationUser: {
              id: memberRowId,
              organizationId,
              userId: member.id,
              role: 'member',
            },
          },
        ],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      });
    if (request.method === 'DELETE' && path.startsWith('/api/v1/organizationUser/')) {
      deleted.push(path.split('/').pop() as string);
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 400 });
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.setState(initialState);
  client.clear();
});

const renderPage = () =>
  render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({
            component: () => <OrganizationUsersPage organizationId={organizationId} />,
          }),
          history: createMemoryHistory({ initialEntries: ['/users/members'] }),
        })}
      />
    </QueryClientProvider>,
  );

describe('OrganizationUsersPage: removing a member', () => {
  it('an owner of the organization removes the member row', async () => {
    await signInAs('owner');
    renderPage();
    await screen.findByText('Mallory Member');
    fireEvent.click(screen.getByLabelText('Remove member'));
    await waitFor(() => expect(deleted).toEqual([memberRowId]));
  });

  it('a viewer is not offered removal', async () => {
    await signInAs('viewer');
    renderPage();
    await screen.findByText('Mallory Member');
    expect(screen.queryByLabelText('Remove member')).toBeNull();
  });
});
