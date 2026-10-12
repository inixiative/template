/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Flow, type MeCreateFlowData, meCreateFlow } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { flowReadQueryKeyFor } from '@template/ui/lib/flows/flowReadQuery';
import { useAppStore } from '@template/ui/store';

export type StartedFlow = { started: boolean; flow: Flow };

export const useStartFlow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MeCreateFlowData['body']): Promise<StartedFlow> => {
      const create = apiMutation((opts: Parameters<typeof meCreateFlow<true>>[0]) =>
        meCreateFlow<true>(opts),
      );
      const { data: flow } = await create({ body });
      const step = flow.steps[flow.currentStep];
      if (!step) return { started: false, flow };

      queryClient.setQueryData(flowReadQueryKeyFor(flow.id), flow);
      const { navigation } = useAppStore.getState();
      navigation.setFlowId(flow.id);
      if (step.to) navigation.navigatePreserving(step.to, 'context');
      return { started: true, flow };
    },
    meta: { skipFlowInvalidate: true },
  });
};
