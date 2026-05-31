import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import type { ChannelKeyInput, WSEvent } from '@template/shared/ws';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';
import { useAppStore } from '@template/ui/store';

const refetchEvent = (key: ChannelKeyInput): WSEvent => ({ category: 'query', action: 'refetch', key });

const qc = () => useAppStore.getState().client!;
const prime = (queryKey: unknown[]) => qc().prefetchQuery({ queryKey, queryFn: async () => ({}) });

describe('dispatchMessage', () => {
  beforeEach(() => useAppStore.setState({ client: new QueryClient() }));

  it('invalidates the exact query on query.refetch', async () => {
    const key = { _id: 'adminBotRead', path: { id: 'b1' } };
    await prime([key]);
    expect(qc().getQueryState([key])?.isInvalidated).toBe(false);

    dispatchMessage(refetchEvent(key));

    expect(qc().getQueryState([key])?.isInvalidated).toBe(true);
  });

  it('pattern-matches: a key with no path invalidates every variant, not unrelated keys', async () => {
    const a = [{ _id: 'userRead', path: { lookup: 'a@x.com' } }];
    const b = [{ _id: 'userRead', path: { lookup: 'b@x.com' } }];
    const other = [{ _id: 'adminBotRead', path: { id: 'x' } }];
    for (const k of [a, b, other]) await prime(k);

    dispatchMessage(refetchEvent({ _id: 'userRead' })); // no path → partial

    expect(qc().getQueryState(a)?.isInvalidated).toBe(true);
    expect(qc().getQueryState(b)?.isInvalidated).toBe(true);
    expect(qc().getQueryState(other)?.isInvalidated).toBe(false);
  });

  it('ignores unknown categories and actions', () => {
    expect(() => dispatchMessage({ category: 'presence', action: 'join' } as never)).not.toThrow();
    expect(() => dispatchMessage({ category: 'query', action: 'explode' } as never)).not.toThrow();
  });
});
