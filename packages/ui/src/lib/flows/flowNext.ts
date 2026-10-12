/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/sdk';
import { pathnameOf } from '@template/ui/lib/flows/pathnameOf';

export type FlowNext = { label: string; to: string; finished: boolean };

export const flowNext = (flow: Flow, pathname: string): FlowNext | null => {
  const step = flow.steps[flow.currentStep];
  if (!step) return { label: 'Finish', to: flow.returnUrl ?? '/dashboard', finished: true };
  if (!step.to || pathnameOf(step.to) === pathname) return null;
  return { label: `Continue: ${step.label}`, to: step.to, finished: false };
};
