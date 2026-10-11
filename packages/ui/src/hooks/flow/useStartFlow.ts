/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation } from '@tanstack/react-query';
import { type MeCreateFlowData, meCreateFlow } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { FLOW_MUTATION_META } from '@template/ui/lib/flows/flowMutationMeta';
import { flowStepTarget } from '@template/ui/lib/flows/flowStepTarget';
import type { Flow } from '@template/ui/lib/flows/flowTypes';
import { withFlowParam } from '@template/ui/lib/flows/withFlowParam';
import { useAppStore } from '@template/ui/store';
import { useCallback } from 'react';

export type StartFlowInput = Omit<MeCreateFlowData['body'], 'returnUrl'> & { returnUrl?: string };

const currentPathWithoutFlow = (): string =>
  withFlowParam(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    null,
  );

export const useStartFlow = () => {
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);
  const { mutateAsync: createFlow, isPending } = useMutation({
    mutationFn: apiMutation((opts: Parameters<typeof meCreateFlow<true>>[0]) =>
      meCreateFlow<true>(opts),
    ),
    throwOnError: false,
    meta: { flowMutation: true },
  });

  const startFlow = useCallback(
    async ({ returnUrl = currentPathWithoutFlow(), ...body }: StartFlowInput): Promise<Flow> => {
      const { data: flow } = await createFlow({ body: { ...body, returnUrl } });
      const step = flow.flowSteps[flow.currentStep];
      const target = flow.completedAt ? flow.returnUrl : step && flowStepTarget(step, flow.id);
      if (target) navigatePreserving(target, 'context');
      return flow;
    },
    [createFlow, navigatePreserving],
  );

  return { startFlow, isPending };
};
