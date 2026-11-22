/**
 * @atlas
 * @kind utils
 * @partOf primitive:flows
 * @uses none
 */
import type { NextFlowStepLink } from '@template/ui/lib/flows/nextFlowStepLink';
import { useAppStore } from '@template/ui/store';

export const navigateToNextFlowStep = ({ to, finished }: NextFlowStepLink): void => {
  const { navigation } = useAppStore.getState();
  if (finished) navigation.setFlowId(null);
  navigation.navigateKeepingSearchParams(to, 'context');
};
