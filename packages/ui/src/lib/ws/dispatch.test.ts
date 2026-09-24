import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { organizationContactsStream } from '@template/db/streams';
import type { ChannelKeyInput, WSEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';
import { listStreamRebase, listStreamReducers } from '@template/ui/lib/ws/listStreamReducers';
import { addStreamListener } from '@template/ui/lib/ws/streamListeners';
import {
  type RegisteredReducers,
  registerStreamReducers,
  type SnapshotRebase,
} from '@template/ui/lib/ws/streamReducers';
import { useAppStore } from '@template/ui/store';
import { contactStreamRow } from '@template/ui/test/contactStreamRow';

const refetchEvent = (key: ChannelKeyInput): WSEvent => ({ category: 'query', action: 'refetch', key });

const qc = () => useAppStore.getState().client!;
const prime = (queryKey: unknown[]) => qc().prefetchQuery({ queryKey, queryFn: async () => ({}) });

describe('dispatchMessage', () => {
  const initialState = useAppStore.getState();
  let resyncs: string[];
  beforeEach(() => {
    resyncs = [];
    useAppStore.setState({
      client: new QueryClient(),
      websocket: { ...initialState.websocket, resync: (stream) => resyncs.push(stream) },
    });
  });
  afterEach(() => useAppStore.setState(initialState));

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

    dispatchMessage(refetchEvent({ _id: 'userRead' }));

    expect(qc().getQueryState(a)?.isInvalidated).toBe(true);
    expect(qc().getQueryState(b)?.isInvalidated).toBe(true);
    expect(qc().getQueryState(other)?.isInvalidated).toBe(false);
  });

  it('ignores unknown categories and actions', () => {
    expect(() => dispatchMessage({ category: 'presence', action: 'join' } as never)).not.toThrow();
    expect(() => dispatchMessage({ category: 'query', action: 'explode' } as never)).not.toThrow();
  });

  describe('data streams', () => {
    const stream = organizationContactsStream.name({ id: 'org-1' });
    const key = dataStreamQueryKey(stream);
    let unregister: () => void;
    let consoleError: ReturnType<typeof spyOn>;
    beforeEach(() => {
      unregister = registerStreamReducers(
        stream,
        listStreamReducers as unknown as RegisteredReducers,
        listStreamRebase as unknown as SnapshotRebase,
      );
      consoleError = spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      unregister();
      consoleError.mockRestore();
    });

    const snapshot = async () => ({ data: [await contactStreamRow({ id: '0001' })] });
    const append = (type: string, payload: unknown): WSEvent => ({
      category: 'data',
      action: 'append',
      stream,
      type,
      payload,
    });

    it('stores a validated snapshot as the stream query data', async () => {
      const payload = await snapshot();
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload });
      expect(qc().getQueryData<unknown>(key)).toEqual(payload);
    });

    it('fails the stream on a snapshot that does not match its schema', async () => {
      qc().setQueryData(key, await snapshot());
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [{ id: 1 }] } });
      expect(qc().getQueryState(key)?.status).toBe('error');
    });

    it('folds a validated append into the snapshot with the registered reducer', async () => {
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: await snapshot() });
      const created = await contactStreamRow({ id: '0002' });
      dispatchMessage(append('upsert', created));
      expect(
        qc()
          .getQueryData<{ data: Array<{ id: string }> }>(key)
          ?.data.map((row) => row.id),
      ).toEqual(['0002', '0001']);
    });

    it('drops an append that arrives with no snapshot to fold into', async () => {
      dispatchMessage(append('upsert', await contactStreamRow({ id: '0002' })));
      expect(qc().getQueryData<unknown>(key)).toBeUndefined();
    });

    it('requests a fresh snapshot instead of folding an invalid or unknown append', async () => {
      const payload = await snapshot();
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload });

      dispatchMessage(append('remove', { id: '0001' }));
      dispatchMessage(append('explode', {}));

      expect(qc().getQueryData<unknown>(key)).toEqual(payload);
      expect(resyncs).toEqual([stream, stream]);
    });

    it('notifies action listeners with the validated payload, isolating a throwing one', async () => {
      const heard: unknown[] = [];
      const removeThrowing = addStreamListener(stream, 'remove', () => {
        throw new Error('listener bug');
      });
      const removeListener = addStreamListener(stream, 'remove', (payload) => heard.push(payload));
      const removal = { id: '0001', updatedAt: new Date().toISOString() };

      dispatchMessage(append('remove', removal));
      removeListener();
      removeThrowing();
      dispatchMessage(append('remove', removal));

      expect(heard).toEqual([removal]);
    });

    it('keeps tombstones across a fresh snapshot, so a late stale upsert still cannot resurrect a row', async () => {
      const removed = await contactStreamRow({ id: '0002', updatedAt: '2026-01-02T00:00:00.000Z' });
      const kept = await contactStreamRow({ id: '0001' });
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [removed, kept] } });
      dispatchMessage(append('remove', { id: '0002', updatedAt: '2026-01-03T00:00:00.000Z' }));
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [kept] } });

      dispatchMessage(append('upsert', removed));

      expect(
        qc()
          .getQueryData<{ data: Array<{ id: string }> }>(key)
          ?.data.map((row) => row.id),
      ).toEqual(['0001']);
    });

    it('ignores frames for a stream family outside the registry', () => {
      const unknown = 'nope:id:x';
      dispatchMessage({ category: 'data', action: 'snapshot', stream: unknown, payload: { data: [] } });
      expect(qc().getQueryData<unknown>(dataStreamQueryKey(unknown))).toBeUndefined();
    });
  });
});
