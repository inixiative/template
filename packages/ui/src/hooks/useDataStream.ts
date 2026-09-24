/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
import { skipToken, type UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@template/ui/hooks/useQuery';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';

export const useDataStream = <TSnapshot>(stream: string): UseQueryResult<TSnapshot, Error> =>
  useQuery<TSnapshot, Error, TSnapshot, readonly unknown[]>({
    queryKey: dataStreamQueryKey(stream),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
  });
