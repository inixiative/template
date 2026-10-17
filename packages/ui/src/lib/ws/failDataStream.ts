/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:ui
 */
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { useAppStore } from '@template/ui/store';

// A rejection means the caller lost access, so its data is wiped; a transient failure keeps the last snapshot.
export const failDataStream = (stream: string, reason: 'rejected' | 'failed'): void => {
  const query = useAppStore
    .getState()
    .client?.getQueryCache()
    .find({ queryKey: dataStreamQueryKey(stream), exact: true });
  query?.setState({
    status: 'error',
    fetchStatus: 'idle',
    ...(reason === 'rejected' ? { data: undefined } : {}),
    error: new Error(`data stream open ${reason}: ${stream}`),
    errorUpdatedAt: Date.now(),
  });
};
