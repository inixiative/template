/**
 * @atlas
 * @kind validator
 * @partOf primitive:flows
 * @uses primitive:errors
 */
import type { Flow } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';

export const validateFlowIsOpen = (flow: Flow): void => {
  if (flow.canceledAt) throw makeError({ status: 409, message: 'Flow was canceled' });
  if (flow.completedAt) throw makeError({ status: 409, message: 'Flow is already complete' });
};

export const validateFlowIsAtStep = (flow: Flow, currentStep: number): void => {
  if (currentStep !== flow.currentStep)
    throw makeError({
      status: 409,
      message: `Step ${currentStep} is not the current step (${flow.currentStep})`,
    });
};
