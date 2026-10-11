/**
 * @atlas
 * @kind constant
 * @partOf primitive:flows
 * @uses none
 */
import type { FlowController } from '@template/ui/lib/flows/flowTypes';
import { createContext } from 'react';

export const FlowContext = createContext<FlowController | null>(null);
