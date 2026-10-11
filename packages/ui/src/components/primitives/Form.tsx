/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:flows
 */
import { isThenable } from '@template/shared/utils/isThenable';
import { FlowContext } from '@template/ui/lib/flows/flowContext';
import * as React from 'react';

export interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => unknown;
}

const submitterCompletesFlow = (event: React.FormEvent<HTMLFormElement>): boolean => {
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  return submitter?.dataset.flow !== 'neutral';
};

const Form = React.forwardRef<HTMLFormElement, FormProps>(({ onSubmit, ...props }, ref) => {
  const flowController = React.useContext(FlowContext);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const result: unknown = onSubmit?.(event);
    if (flowController?.isActive && isThenable(result) && submitterCompletesFlow(event))
      void result.then(
        () => flowController.advance().catch(() => undefined),
        () => undefined,
      );
  };

  return <form ref={ref} onSubmit={handleSubmit} {...props} />;
});
Form.displayName = 'Form';

export { Form };
