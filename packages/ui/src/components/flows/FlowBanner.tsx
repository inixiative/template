/**
 * @atlas
 * @kind component
 * @partOf primitive:flows
 * @uses primitive:ui
 */
import { Button } from '@template/ui/components/primitives/Button';
import { useFlow } from '@template/ui/hooks/flow/useFlow';

export const FlowBanner = () => {
  const flowController = useFlow();
  if (!flowController?.isActive || !flowController.currentFlowStep) return null;

  const { flow, currentFlowStep, cancel } = flowController;
  const stepNumber = flow.currentStep + 1;
  const stepCount = flow.flowSteps.length;

  return (
    <section
      aria-label="Flow progress"
      className="flex items-center justify-between gap-4 border-b bg-muted/40 px-4 py-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 text-sm">
        <span className="shrink-0 text-muted-foreground">
          Step {stepNumber} of {stepCount}
        </span>
        <span className="truncate font-medium">{currentFlowStep.label}</span>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-valuenow={flow.currentStep}
          className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-muted sm:block"
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(flow.currentStep / stepCount) * 100}%` }}
          />
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={cancel}>
        Cancel
      </Button>
    </section>
  );
};
