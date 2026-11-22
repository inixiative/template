/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { skipToken, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';

export const useDataStreamSnapshot = <TSnapshot>(
  stream: string,
): UseQueryResult<TSnapshot, Error> =>
  useQuery<TSnapshot, Error, TSnapshot, readonly unknown[]>({
    queryKey: dataStreamQueryKey(stream),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
  });
