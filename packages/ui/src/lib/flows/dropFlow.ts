/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { flowDelete } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { useAppStore } from '@template/ui/store';

export const dropFlow = (): void => {
  const { flowId, clearFlow } = useAppStore.getState().navigation;
  clearFlow();
  if (flowId) apiMutation(flowDelete)({ path: { id: flowId } }).catch(() => undefined);
};
