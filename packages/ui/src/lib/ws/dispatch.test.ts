import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { type ChannelKeyInput, STREAM_DEFINITIONS, type WSEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';
import { addStreamListener } from '@template/ui/lib/ws/streamListeners';
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
    const stream = STREAM_DEFINITIONS.organizationReadManyContacts.name({ id: 'org-1' });
    const key = dataStreamQueryKey(stream);
    let consoleError: ReturnType<typeof spyOn>;
    beforeEach(() => {
      consoleError = spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => consoleError.mockRestore());

    const snapshot = async () => ({ data: [await contactStreamRow({ id: '0001' })] });
    const append = (type: string, payload: unknown): WSEvent => ({
      category: 'data',
      action: 'append',
      stream,
      type,
      payload,
    });

    it('stores a snapshot as the stream query data', async () => {
      const payload = await snapshot();
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload });
      expect(qc().getQueryData<unknown>(key)).toEqual(payload);
    });

    it('folds an append into the snapshot by the stream kind', async () => {
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

    it('requests a fresh snapshot instead of folding an op its kind does not define', async () => {
      const payload = await snapshot();
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload });

      dispatchMessage(append('append', {}));

      expect(qc().getQueryData<unknown>(key)).toEqual(payload);
      expect(resyncs).toEqual([stream]);
    });

    it('notifies action listeners with the payload, isolating a throwing one', async () => {
      const heard: unknown[] = [];
      const removeThrowing = addStreamListener(stream, 'remove', () => {
        throw new Error('listener bug');
      });
      const removeListener = addStreamListener(stream, 'remove', (payload) => heard.push(payload));
      const removal = { id: '0001' };

      dispatchMessage(append('remove', removal));
      removeListener();
      removeThrowing();
      dispatchMessage(append('remove', removal));

      expect(heard).toEqual([removal]);
    });

    it('keeps tombstones across a fresh snapshot, so a late upsert still cannot resurrect a row', async () => {
      const removed = await contactStreamRow({ id: '0002' });
      const kept = await contactStreamRow({ id: '0001' });
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [removed, kept] } });
      dispatchMessage(append('remove', { id: '0002' }));
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [kept] } });

      dispatchMessage(append('upsert', removed));

      expect(
        qc()
          .getQueryData<{ data: Array<{ id: string }> }>(key)
          ?.data.map((row) => row.id),
      ).toEqual(['0001']);
    });

    it('restores a removed row only from an upsert frame flagged revive', async () => {
      const removed = await contactStreamRow({ id: '0002' });
      const kept = await contactStreamRow({ id: '0001' });
      const held = () =>
        qc()
          .getQueryData<{ data: Array<{ id: string }> }>(key)
          ?.data.map((row) => row.id);
      dispatchMessage({ category: 'data', action: 'snapshot', stream, payload: { data: [removed, kept] } });
      dispatchMessage(append('remove', { id: '0002' }));

      dispatchMessage(append('upsert', removed));
      expect(held()).toEqual(['0001']);

      dispatchMessage({ category: 'data', action: 'append', stream, type: 'upsert', payload: removed, revive: true });
      expect(held()).toEqual(['0002', '0001']);
    });

    it('ignores frames for a stream family outside the registry', () => {
      const unknown = 'nope:id:x';
      dispatchMessage({ category: 'data', action: 'snapshot', stream: unknown, payload: { data: [] } });
      expect(qc().getQueryData<unknown>(dataStreamQueryKey(unknown))).toBeUndefined();
    });
  });
});
