/**
 * @atlas
 * @kind component
 * @partOf primitive:flows
 * @uses primitive:ui
 */
import { useQuery } from '@tanstack/react-query';
import { Button } from '@template/ui/components/primitives/Button';
import { dropFlow } from '@template/ui/lib/flows/dropFlow';
import { flowReadQuery } from '@template/ui/lib/flows/flowReadQuery';
import { useAppStore } from '@template/ui/store';

export const FlowBanner = () => {
  const flowId = useAppStore((state) => state.navigation.flowId);
  const flow = useAppStore((state) => state.navigation.flow);
  const flowContinue = useAppStore((state) => state.navigation.flowContinue);
  const continueFlow = useAppStore((state) => state.navigation.continueFlow);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useQuery({ ...flowReadQuery(flowId ?? ''), enabled: !!flowId && isAuthenticated });

  if (!flow) return null;

  const stepCount = flow.steps.length;
  const finished = flow.currentStep >= stepCount;
  const step = flow.steps[flow.currentStep];

  return (
    <section
      aria-label="Setup guide"
      className="fixed bottom-4 right-4 z-40 w-80 space-y-3 rounded-lg border bg-background p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2 text-sm">
        <div className="min-w-0">
          <p className="text-muted-foreground">
            {finished ? 'All set' : `Step ${flow.currentStep + 1} of ${stepCount}`}
          </p>
          <p className="truncate font-medium">
            {finished ? 'Done — back to where you were' : step?.label}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dropFlow}>
          Dismiss
        </Button>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stepCount}
        aria-valuenow={flow.currentStep}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(flow.currentStep / stepCount) * 100}%` }}
        />
      </div>
      {flowContinue && (
        <Button size="sm" className="w-full" onClick={continueFlow}>
          {flowContinue.label}
        </Button>
      )}
    </section>
  );
};
