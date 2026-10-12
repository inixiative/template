/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useMutation } from '@tanstack/react-query';
import { type MeCreateFlowData, meCreateFlow } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { currentPath } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';

export const useStartFlow = () =>
  useMutation({
    mutationFn: ({ flowKey, bindings }: MeCreateFlowData['body']) =>
      apiMutation((opts: Parameters<typeof meCreateFlow<true>>[0]) => meCreateFlow<true>(opts))({
        body: { flowKey, bindings: { returnUrl: currentPath(), ...bindings } },
      }),
    meta: { skipFlowInvalidate: true },
    onSuccess: ({ data: flow }) => {
      const { navigation } = useAppStore.getState();
      const step = flow.steps[flow.currentStep];
      if (!step) return navigation.navigatePreserving(flow.returnUrl ?? '/dashboard', 'context');
      navigation.setFlowId(flow.id);
      navigation.receiveFlow(flow);
      if (step.to) navigation.navigatePreserving(step.to, 'context');
    },
  });
