/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { flowCancel, flowCheck, flowRead, flowReadQueryKey } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { FLOW_MUTATION_META, isFlowMutation } from '@template/ui/lib/flows/flowMutationMeta';
import { flowStepNavigation } from '@template/ui/lib/flows/flowStepNavigation';
import type { Flow, FlowController } from '@template/ui/lib/flows/flowTypes';
import { useEffect, useMemo, useRef } from 'react';

export const useFlowController = (flowId: string | null): FlowController | null => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const queryKey = useMemo(() => flowReadQueryKey({ path: { id: flowId ?? '' } }), [flowId]);
  const pendingCheck = useRef<Promise<void> | null>(null);
  const recheck = useRef(false);
  const activeFlowId = useRef(flowId);

  const { data } = useQuery({
    queryKey,
    queryFn: apiQuery((opts: Parameters<typeof flowRead>[0]) =>
      flowRead({ ...opts, path: { id: flowId ?? '' } }),
    ),
    enabled: flowId !== null,
    throwOnError: false,
    retry: false,
    meta: { skipErrorToast: true },
  });

  const { mutateAsync: checkFlow } = useMutation({
    mutationFn: apiMutation((opts: Parameters<typeof flowCheck<true>>[0]) => flowCheck<true>(opts)),
    throwOnError: false,
    meta: { ...FLOW_MUTATION_META, skipErrorToast: true },
  });

  const { mutateAsync: cancelFlow } = useMutation({
    mutationFn: apiMutation((opts: Parameters<typeof flowCancel<true>>[0]) =>
      flowCancel<true>(opts),
    ),
    throwOnError: false,
    meta: FLOW_MUTATION_META,
  });

  const flow = flowId ? data?.data : undefined;

  const controller = useMemo(() => {
    if (!flow) return null;
    const isActive = !flow.completedAt && !flow.canceledAt;

    const settle = (next: Flow) => {
      const previous = queryClient.getQueryData<{ data: Flow }>(queryKey)?.data;
      queryClient.setQueryData<{ data: Flow }>(queryKey, (old) =>
        old ? { ...old, data: next } : { data: next },
      );
      if (activeFlowId.current !== next.id) return;
      if (next.completedAt || next.canceledAt) {
        void navigate({ href: next.returnUrl });
        return;
      }
      if (next.currentStep === previous?.currentStep) return;
      const step = next.flowSteps[next.currentStep];
      const target = step && flowStepNavigation(step, next.id);
      if (target) void navigate(target);
    };

    const runCheck = async (): Promise<void> => {
      const { data: next } = await checkFlow({ path: { id: flow.id } });
      settle(next);
      if (recheck.current) {
        recheck.current = false;
        await runCheck();
      }
    };

    const check = () => {
      if (!isActive) return Promise.resolve();
      if (pendingCheck.current) {
        recheck.current = true;
        return pendingCheck.current;
      }
      pendingCheck.current = runCheck().finally(() => {
        pendingCheck.current = null;
      });
      return pendingCheck.current;
    };

    const cancel = async () => {
      const { data: next } = await cancelFlow({ path: { id: flow.id } });
      settle(next);
    };

    return {
      flow,
      currentFlowStep: flow.flowSteps[flow.currentStep] ?? null,
      isActive,
      check,
      cancel,
    };
  }, [flow, queryClient, queryKey, navigate, checkFlow, cancelFlow]);

  useEffect(() => {
    activeFlowId.current = flowId;
    pendingCheck.current = null;
    recheck.current = false;
    return () => {
      activeFlowId.current = null;
    };
  }, [flowId]);

  useEffect(() => {
    if (!controller?.isActive) return;
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      if (isFlowMutation(event.mutation.meta)) return;
      void controller.check().catch(() => undefined);
    });
  }, [controller, queryClient]);

  return controller;
};
