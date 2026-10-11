/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flowAdvance, flowCancel, flowRead, flowReadQueryKey } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { Flow, FlowController } from '@template/ui/lib/flows/flowTypes';
import { useAppStore } from '@template/ui/store';
import { useMemo, useRef } from 'react';

export const useFlowController = (flowId: string): FlowController | null => {
  const queryClient = useQueryClient();
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);
  const queryKey = useMemo(() => flowReadQueryKey({ path: { id: flowId } }), [flowId]);
  const pendingAdvance = useRef<Promise<void> | null>(null);

  const { data } = useQuery({
    queryKey,
    queryFn: apiQuery((opts: Parameters<typeof flowRead>[0]) =>
      flowRead({ ...opts, path: { id: flowId } }),
    ),
    throwOnError: false,
  });

  const { mutateAsync: advanceFlow } = useMutation({
    mutationFn: apiMutation((opts: Parameters<typeof flowAdvance<true>>[0]) =>
      flowAdvance<true>(opts),
    ),
    throwOnError: false,
  });

  const { mutateAsync: cancelFlow } = useMutation({
    mutationFn: apiMutation((opts: Parameters<typeof flowCancel<true>>[0]) =>
      flowCancel<true>(opts),
    ),
    throwOnError: false,
  });

  const flow = data?.data;

  return useMemo(() => {
    if (!flow) return null;

    const settle = (next: Flow) => {
      queryClient.setQueryData<{ data: Flow }>(queryKey, (old) =>
        old ? { ...old, data: next } : { data: next },
      );
      const nextStep = next.flowSteps[next.currentStep];
      if (next.completedAt || next.canceledAt || !nextStep)
        navigatePreserving(next.returnUrl, 'context');
      else navigatePreserving(nextStep.url, 'flow');
    };

    const advance = () => {
      pendingAdvance.current ??= advanceFlow({
        path: { id: flow.id },
        body: { currentStep: flow.currentStep },
      })
        .then(({ data: next }) => settle(next))
        .finally(() => {
          pendingAdvance.current = null;
        });
      return pendingAdvance.current;
    };

    const cancel = async () => {
      const { data: next } = await cancelFlow({ path: { id: flow.id } });
      settle(next);
    };

    return {
      flow,
      currentFlowStep: flow.flowSteps[flow.currentStep] ?? null,
      isActive: !flow.completedAt && !flow.canceledAt,
      advance,
      cancel,
    };
  }, [flow, queryClient, queryKey, navigatePreserving, advanceFlow, cancelFlow]);
};
