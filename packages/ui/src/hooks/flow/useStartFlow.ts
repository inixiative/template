/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type MeCreateFlowData, meCreateFlow } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { FLOW_MUTATION_META } from '@template/ui/lib/flows/flowMutationMeta';
import { flowStepNavigation } from '@template/ui/lib/flows/flowStepNavigation';
import type { Flow } from '@template/ui/lib/flows/flowTypes';
import { withFlowParam } from '@template/ui/lib/flows/withFlowParam';
import { useCallback } from 'react';

export type StartFlowInput = Omit<MeCreateFlowData['body'], 'returnUrl'> & { returnUrl?: string };

const currentPathWithoutFlow = (): string =>
  withFlowParam(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    null,
  );

export const useStartFlow = () => {
  const navigate = useNavigate();
  const { mutateAsync: createFlow, isPending } = useMutation({
    mutationFn: apiMutation((opts: Parameters<typeof meCreateFlow<true>>[0]) =>
      meCreateFlow<true>(opts),
    ),
    throwOnError: false,
    meta: FLOW_MUTATION_META,
  });

  const startFlow = useCallback(
    async ({ returnUrl = currentPathWithoutFlow(), ...body }: StartFlowInput): Promise<Flow> => {
      const { data: flow } = await createFlow({ body: { ...body, returnUrl } });
      const step = flow.flowSteps[flow.currentStep];
      if (flow.completedAt || !step) await navigate({ href: flow.returnUrl });
      else {
        const target = flowStepNavigation(step, flow.id);
        if (target) await navigate(target);
      }
      return flow;
    },
    [createFlow, navigate],
  );

  return { startFlow, isPending };
};
