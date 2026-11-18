/**
 * @atlas
 * @kind utils
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/sdk';
import { pathnameOf } from '@template/ui/lib/flows/pathnameOf';

export type NextFlowStepLink = { label: string; to: string; finished: boolean };

export const nextFlowStepLink = (flow: Flow, pathname: string): NextFlowStepLink | null => {
  const step = flow.steps[flow.currentStep];
  if (!step) return { label: 'Finish', to: flow.returnUrl ?? '/dashboard', finished: true };
  if (!step.to || pathnameOf(step.to) === pathname) return null;
  return { label: `Continue: ${step.label}`, to: step.to, finished: false };
};
