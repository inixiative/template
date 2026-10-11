/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { FlowStep } from '@template/ui/lib/flows/flowTypes';
import { withFlowParam } from '@template/ui/lib/flows/withFlowParam';

export const flowStepTarget = (step: FlowStep, flowId: string): string | null =>
  step.mode === 'action' ? null : withFlowParam(step.url, flowId);
