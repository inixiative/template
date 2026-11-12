/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Role } from '@template/db/generated/client/enums';
import { buildUser } from '@template/db/test';
import { SpaceTransferInquiryPage } from '@template/ui/pages/SpaceTransferInquiryPage';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';
import { cleanup, render, screen } from '@testing-library/react';

const initialState = useAppStore.getState();
const organizationId = '01a17900-0000-7000-8000-000000000011';
const spaceId = '01a17900-0000-7000-8000-000000000012';

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;

type Me = Parameters<ReturnType<typeof useAppStore.getState>['permissions']['setup']>[0];

const signInAs = async (roles: { organization?: Role; space?: Role }) => {
  const { entity } = await buildUser();
  const me = {
    ...entity.__serialize(),
    organizationUsers: roles.organization
      ? [{ id: 'ou', organizationId, userId: entity.id, role: roles.organization }]
      : [],
    organizations: [],
    spaceUsers: roles.space
      ? [{ id: 'su', organizationId, spaceId, userId: entity.id, role: roles.space }]
      : [],
    spaces: [],
  } as unknown as Me;
  useAppStore.getState().permissions.clear();
  await useAppStore.getState().permissions.setup(me);
  useAppStore.setState((state) => ({
    tenant: {
      ...state.tenant,
      context: {
        type: 'space',
        organization: { id: organizationId },
        space: { id: spaceId, organizationId },
      } as unknown as TenantContext,
    },
  }));
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const intercept = async (input: RequestInfo | URL) => {
    const path = new URL((input as Request).url).pathname;
    if (path === `/api/v1/space/${spaceId}/inquiries/sent`)
      return Response.json({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      });
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

const renderPage = async () => {
  render(
    <QueryClientProvider client={client}>
      <SpaceTransferInquiryPage />
    </QueryClientProvider>,
  );
  await screen.findByText('New transfer request');
};

describe('SpaceTransferInquiryPage: requesting a transfer', () => {
  it("the owner of the space's organization is offered the transfer", async () => {
    await signInAs({ organization: 'owner' });
    await renderPage();
    expect(screen.queryByRole('button', { name: 'Request transfer' })).not.toBeNull();
  });

  it("an admin of the space's organization is not", async () => {
    await signInAs({ organization: 'admin' });
    await renderPage();
    expect(screen.queryByRole('button', { name: 'Request transfer' })).toBeNull();
  });

  it('an owner of the space alone is not', async () => {
    await signInAs({ space: 'owner' });
    await renderPage();
    expect(screen.queryByRole('button', { name: 'Request transfer' })).toBeNull();
  });
});
