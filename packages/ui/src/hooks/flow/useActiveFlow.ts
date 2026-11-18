/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses none
 */
import { useQuery } from '@tanstack/react-query';
import type { Flow } from '@template/sdk';
import { flowReadQueryOptions } from '@template/ui/lib/flows/flowReadQueryOptions';
import { useAppStore } from '@template/ui/store';

export const useActiveFlow = (): Flow | null => {
  const flowId = useAppStore((state) => state.navigation.flowId);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const { data } = useQuery({
    ...flowReadQueryOptions(flowId ?? ''),
    enabled: !!flowId && isAuthenticated,
  });
  return flowId && data?.id === flowId ? data : null;
};
