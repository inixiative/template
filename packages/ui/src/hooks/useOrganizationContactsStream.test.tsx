import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildContact } from '@template/db/test';
import type { OrganizationReadManyContactsResponse } from '@template/sdk';
import { WS_CHANNELS } from '@template/shared/ws';
import { useOrganizationContactsStream } from '@template/ui/hooks/useOrganizationContactsStream';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';
import { failDataStream } from '@template/ui/lib/ws/failDataStream';
import { useAppStore } from '@template/ui/store';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

type ContactRow = OrganizationReadManyContactsResponse['data'][number];

const organizationId = 'org-1';
const stream = WS_CHANNELS.organizationReadManyContacts.name(organizationId);
const initialState = useAppStore.getState();

const contactRow = async (): Promise<ContactRow> => {
  const { entity } = await buildContact({ ownerModel: 'Organization', organizationId });
  return entity.__serialize() as ContactRow;
};

describe('useOrganizationContactsStream', () => {
  let opens: string[];
  let closes: string[];
  let client: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    opens = [];
    closes = [];
    client = new QueryClient();
    useAppStore.setState({
      websocket: {
        ...initialState.websocket,
        open: (name) => opens.push(name),
        close: (name) => closes.push(name),
      },
    });
    useAppStore.getState().setClient(client);
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(initialState);
  });

  it('holds the stream open while mounted and closes it on unmount', () => {
    const { result, unmount } = renderHook(() => useOrganizationContactsStream(organizationId), { wrapper });

    expect(opens).toEqual([stream]);
    expect(result.current.isPending).toBe(true);

    unmount();
    expect(closes).toEqual([stream]);
  });

  it('renders the snapshot, then each append folded into it', async () => {
    const existing = await contactRow();
    const created = await contactRow();
    const { result } = renderHook(() => useOrganizationContactsStream(organizationId), { wrapper });

    act(() => dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [existing] } }));
    await waitFor(() => expect(result.current.data?.data).toEqual([existing]));

    act(() => dispatchMessage({ category: 'data', action: 'append', stream, payload: { upsert: created } }));
    await waitFor(() => expect(result.current.data?.data).toEqual([created, existing]));

    act(() => dispatchMessage({ category: 'data', action: 'append', stream, payload: { remove: existing.id } }));
    await waitFor(() => expect(result.current.data?.data).toEqual([created]));
  });

  it('surfaces a rejected open as an error with no data', async () => {
    const { result } = renderHook(() => useOrganizationContactsStream(organizationId), { wrapper });

    act(() => dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [] } }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => failDataStream(stream, 'rejected'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
