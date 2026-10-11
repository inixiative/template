/**
 * @atlas
 * @kind component
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { useSearch } from '@tanstack/react-router';
import { useFlowController } from '@template/ui/hooks/flow/useFlowController';
import { FlowContext } from '@template/ui/lib/flows/flowContext';
import { FLOW_SEARCH_PARAM } from '@template/ui/lib/flows/flowSearchParam';
import type { ReactNode } from 'react';

const ActiveFlowProvider = ({ flowId, children }: { flowId: string; children: ReactNode }) => {
  const controller = useFlowController(flowId);
  return <FlowContext.Provider value={controller}>{children}</FlowContext.Provider>;
};

export const FlowProvider = ({ children }: { children: ReactNode }) => {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const flowId = search[FLOW_SEARCH_PARAM];

  if (typeof flowId !== 'string' || !flowId) return children;
  return <ActiveFlowProvider flowId={flowId}>{children}</ActiveFlowProvider>;
};
