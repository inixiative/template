/**
 * @atlas
 * @kind type
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import type { FlowReadResponses } from '@template/sdk';

export type Flow = FlowReadResponses[200]['data'];

export type FlowStep = Flow['flowSteps'][number];

export type FlowController = {
  flow: Flow;
  currentFlowStep: FlowStep | null;
  isActive: boolean;
  advance: () => Promise<void>;
  cancel: () => Promise<void>;
};
