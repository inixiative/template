import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type { ApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { useAppStore } from '@template/ui/store';

const recordingWebsocket = () => {
  const subs: string[] = [];
  const unsubs: string[] = [];
  const opens: string[] = [];
  const closes: string[] = [];
  const websocket = {
    connect: () => {},
    authenticate: () => {},
    spoof: () => {},
    unspoof: () => {},
    logout: () => {},
    subscribe: (channel: string) => subs.push(channel),
    unsubscribe: (channel: string) => unsubs.push(channel),
    open: (stream: string) => opens.push(stream),
    close: (stream: string) => closes.push(stream),
    resync: () => {},
  } satisfies ApiWebsocket;
  return { subs, unsubs, opens, closes, websocket };
};

const mount = (client: QueryClient, queryKey: unknown[]) =>
  new QueryObserver(client, { queryKey, queryFn: async () => null }).subscribe(() => {});

describe('client slice — live query pipe', () => {
  let rec: ReturnType<typeof recordingWebsocket>;
  let client: QueryClient;

  beforeEach(() => {
    rec = recordingWebsocket();
    client = new QueryClient();
    useAppStore.setState({ websocket: rec.websocket });
    useAppStore.getState().setClient(client);
  });

  it('subscribes a live query channel on mount and unsubscribes on unmount', () => {
    const unmount = mount(client, [{ _id: 'inquiryRead', path: { id: 'a' } }]);
    expect(rec.subs).toContain('inquiryRead:id:a');

    unmount();
    expect(rec.unsubs).toContain('inquiryRead:id:a');
  });

  it('ignores queries not in the registry', () => {
    mount(client, [{ _id: 'adminBotRead', path: { id: 'b1' } }]);
    expect(rec.subs).toEqual([]);
  });

  it('opens a data stream on mount and closes it on unmount, without subscribing a channel', () => {
    const unmount = mount(client, [...dataStreamQueryKey('organizationReadManyContacts:id:o1')]);
    expect(rec.opens).toEqual(['organizationReadManyContacts:id:o1']);
    expect(rec.subs).toEqual([]);

    unmount();
    expect(rec.closes).toEqual(['organizationReadManyContacts:id:o1']);
  });
});
