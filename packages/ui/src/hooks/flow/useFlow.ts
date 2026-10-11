/**
 * @atlas
 * @kind hook
 * @partOf primitive:flows
 * @uses none
 */
import { FlowContext } from '@template/ui/lib/flows/flowContext';
import type { FlowController } from '@template/ui/lib/flows/flowTypes';
import { useContext } from 'react';

export const useFlow = (): FlowController | null => useContext(FlowContext);
