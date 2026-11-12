/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
const DATA_STREAM_QUERY = 'dataStream';

export const dataStreamQueryKey = (stream: string) => [DATA_STREAM_QUERY, stream] as const;

export const dataStreamOfQueryKey = (queryKey: readonly unknown[]): string | null =>
  queryKey[0] === DATA_STREAM_QUERY && typeof queryKey[1] === 'string' ? queryKey[1] : null;
