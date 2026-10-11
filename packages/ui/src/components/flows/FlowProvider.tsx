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

export const FlowProvider = ({ children }: { children: ReactNode }) => {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const flowParam = search[FLOW_SEARCH_PARAM];
  const controller = useFlowController(
    typeof flowParam === 'string' && flowParam ? flowParam : null,
  );
  return <FlowContext.Provider value={controller}>{children}</FlowContext.Provider>;
};
