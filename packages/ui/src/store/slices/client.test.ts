import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type { ApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';
import { useAppStore } from '@template/ui/store';

const recordingWebsocket = () => {
  const subs: string[] = [];
  const unsubs: string[] = [];
  const websocket = {
    connect: () => {},
    authenticate: () => {},
    spoof: () => {},
    unspoof: () => {},
    logout: () => {},
    subscribe: (channel: string) => subs.push(channel),
    unsubscribe: (channel: string) => unsubs.push(channel),
  } satisfies ApiWebsocket;
  return { subs, unsubs, websocket };
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
});
