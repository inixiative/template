/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import { FLOW_SEARCH_PARAM } from '@template/ui/lib/flows/flowSearchParam';

export const withFlowParam = (url: string, flowId: string | null): string => {
  const parsed = new URL(url, 'http://localhost');
  if (flowId) parsed.searchParams.set(FLOW_SEARCH_PARAM, flowId);
  else parsed.searchParams.delete(FLOW_SEARCH_PARAM);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};
