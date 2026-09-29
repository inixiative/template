import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { STREAM_DEFINITIONS } from '@template/shared/ws';
import type { OrganizationContactsStream } from '@template/ui/hooks/useOrganizationContactsStream';
import { useOrganizationContactsStream } from '@template/ui/hooks/useOrganizationContactsStream';
import { useStream } from '@template/ui/hooks/useStream';
import { useStreamAction } from '@template/ui/hooks/useStreamAction';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';
import { failDataStream } from '@template/ui/lib/ws/failDataStream';
import { useAppStore } from '@template/ui/store';
import { contactStreamRow } from '@template/ui/test/contactStreamRow';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const organizationId = 'org-1';
const stream = STREAM_DEFINITIONS.organizationReadManyContacts.name({ id: organizationId });
const initialState = useAppStore.getState();

describe('useStream / useStreamAction', () => {
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

  it('renders the snapshot, then each typed action folded into it', async () => {
    const existing = await contactStreamRow({ id: '0001' });
    const created = await contactStreamRow({ id: '0002' });
    const { result } = renderHook(() => useOrganizationContactsStream(organizationId), { wrapper });

    act(() => dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [existing] } }));
    await waitFor(() => expect(result.current.data?.data).toEqual([existing]));

    act(() => dispatchMessage({ category: 'data', action: 'append', stream, type: 'upsert', payload: created }));
    await waitFor(() => expect(result.current.data?.data).toEqual([created, existing]));

    act(() =>
      dispatchMessage({ category: 'data', action: 'append', stream, type: 'remove', payload: { id: existing.id } }),
    );
    await waitFor(() => expect(result.current.data?.data).toEqual([created]));
  });

  it('shares one open stream between a reducer holder and any number of action listeners', async () => {
    const heard: string[] = [];
    const { result, unmount } = renderHook(
      () => {
        const contacts = useStream<OrganizationContactsStream>(stream);
        useStreamAction<{ id: string }>(stream, 'remove', (removal) => heard.push(`a:${removal.id}`));
        useStreamAction<{ id: string }>(stream, 'remove', (removal) => heard.push(`b:${removal.id}`));
        return contacts;
      },
      { wrapper },
    );
    const existing = await contactStreamRow({ id: '0001' });

    act(() => dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [existing] } }));
    act(() =>
      dispatchMessage({ category: 'data', action: 'append', stream, type: 'remove', payload: { id: existing.id } }),
    );

    await waitFor(() => expect(result.current.data?.data).toEqual([]));
    expect(heard).toEqual(['a:0001', 'b:0001']);
    expect(opens).toEqual([stream, stream, stream]);

    unmount();
    expect(closes).toEqual([stream, stream, stream]);
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
