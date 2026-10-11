/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation } from '@tanstack/react-query';
import { type MeCreateFlowData, meCreateFlow } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { Flow } from '@template/ui/lib/flows/flowTypes';
import { withFlowParam } from '@template/ui/lib/flows/withFlowParam';
import { useAppStore } from '@template/ui/store';
import { useCallback } from 'react';

export type StartFlowInput = {
  flowSteps: MeCreateFlowData['body']['flowSteps'];
  returnUrl?: string;
};

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
  });

  const startFlow = useCallback(
    async ({ flowSteps, returnUrl = currentPathWithoutFlow() }: StartFlowInput): Promise<Flow> => {
      const { data: flow } = await createFlow({ body: { flowSteps, returnUrl } });
      const [firstStep] = flow.flowSteps;
      if (firstStep) navigatePreserving(withFlowParam(firstStep.url, flow.id), 'context');
      return flow;
    },
    [createFlow, navigatePreserving],
  );

  return { startFlow, isPending };
};
