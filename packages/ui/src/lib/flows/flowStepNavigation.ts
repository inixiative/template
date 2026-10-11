/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses primitive:flows
 */
import { FLOW_SEARCH_PARAM } from '@template/ui/lib/flows/flowSearchParam';
import type { FlowStep } from '@template/ui/lib/flows/flowTypes';
import { pickSearchParams } from '@template/ui/lib/searchParams';

export type FlowStepNavigation = {
  to: string;
  params: Record<string, string>;
  search: (previous: Record<string, unknown>) => Record<string, unknown>;
  hash?: string;
};

export const flowStepNavigation = (step: FlowStep, flowId: string): FlowStepNavigation | null =>
  step.mode === 'action'
    ? null
    : {
        to: step.to,
        params: step.params,
        search: (previous) => ({
          ...pickSearchParams(previous, ['spoof']),
          ...step.search,
          [FLOW_SEARCH_PARAM]: flowId,
        }),
        hash: step.hash ?? undefined,
      };
