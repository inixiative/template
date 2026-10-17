/**
 * @atlas
 * @kind component
 * @partOf primitive:flows
 * @uses primitive:ui
 */
import { useLocation } from '@tanstack/react-router';
import { FlowStepAdvance } from '@template/shared/flows';
import { Button } from '@template/ui/components/primitives/Button';
import { useActiveFlow } from '@template/ui/hooks/flow/useActiveFlow';
import { dropFlow } from '@template/ui/lib/flows/dropFlow';
import { flowNext } from '@template/ui/lib/flows/flowNext';
import { followFlow } from '@template/ui/lib/flows/followFlow';
import { useEffect, useRef } from 'react';

export const FlowBanner = () => {
  const flow = useActiveFlow();
  const { pathname } = useLocation();
  const seen = useRef<{ id: string; currentStep: number } | null>(null);

  useEffect(() => {
    if (!flow) return;
    const previous = seen.current?.id === flow.id ? seen.current.currentStep : null;
    seen.current = { id: flow.id, currentStep: flow.currentStep };
    if (previous === null || flow.currentStep <= previous) return;
    if (flow.steps[flow.currentStep - 1]?.advance !== FlowStepAdvance.auto) return;
    const next = flowNext(flow, pathname);
    if (next) followFlow(next);
  }, [flow, pathname]);

  if (!flow) return null;

  const stepCount = flow.steps.length;
  const finished = flow.currentStep >= stepCount;
  const next = flowNext(flow, pathname);

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
            {finished ? 'Done — back to where you were' : flow.steps[flow.currentStep]?.label}
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
      {next && (
        <Button size="sm" className="w-full" onClick={() => followFlow(next)}>
          {next.label}
        </Button>
      )}
    </section>
  );
};
