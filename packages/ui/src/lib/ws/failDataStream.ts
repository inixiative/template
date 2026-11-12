/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:ui
 */
import type { QueryClient } from '@tanstack/react-query';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';

// A rejection means the caller lost access, so its data is wiped; a transient failure keeps the last snapshot.
export const failDataStream = (
  client: QueryClient | null,
  stream: string,
  reason: 'rejected' | 'failed',
): void => {
  const query = client?.getQueryCache().find({ queryKey: dataStreamQueryKey(stream), exact: true });
  query?.setState({
    status: 'error',
    fetchStatus: 'idle',
    ...(reason === 'rejected' ? { data: undefined } : {}),
    error: new Error(`data stream open ${reason}: ${stream}`),
    errorUpdatedAt: Date.now(),
  });
};
