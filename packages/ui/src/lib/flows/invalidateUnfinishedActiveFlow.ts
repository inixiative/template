/**
 * @atlas
 * @kind utils
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import type { QueryClient } from '@tanstack/react-query';
import type { Flow } from '@template/sdk';
import { flowReadQueryKeyFor } from '@template/ui/lib/flows/flowReadQueryOptions';
import { useAppStore } from '@template/ui/store';

export const invalidateUnfinishedActiveFlow = (queryClient: QueryClient): void => {
  const { flowId } = useAppStore.getState().navigation;
  if (!flowId) return;
  const queryKey = flowReadQueryKeyFor(flowId);
  const flow = queryClient.getQueryData<Flow>(queryKey);
  if (flow && flow.currentStep >= flow.steps.length) return;
  void queryClient.invalidateQueries({ queryKey });
};
