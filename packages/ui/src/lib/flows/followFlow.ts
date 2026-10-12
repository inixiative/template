/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { FlowNext } from '@template/ui/lib/flows/flowNext';
import { useAppStore } from '@template/ui/store';

export const followFlow = ({ to, finished }: FlowNext): void => {
  const { navigation } = useAppStore.getState();
  if (finished) navigation.setFlowId(null);
  navigation.navigatePreserving(to, 'context');
};
