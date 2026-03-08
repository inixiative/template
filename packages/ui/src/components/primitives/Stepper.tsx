import * as Ariakit from '@ariakit/react';
import { cn } from '@template/ui/lib/utils';

export type StepperStep = {
  label: string;
  state: 'completed' | 'active' | 'upcoming';
};

export type StepperProps = {
  steps: StepperStep[];
  mode?: 'linear' | 'nonLinear';
  onStepChange?: (stepIndex: number) => void;
  className?: string;
  show?: boolean | (() => boolean);
};

const getStepId = (index: number): string => `step-${index}`;

export const Stepper = ({ steps, mode = 'linear', onStepChange, className, show = true }: StepperProps) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow || steps.length === 0) return null;

  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.state === 'active'),
  );

  return (
    <Ariakit.TabProvider selectedId={getStepId(activeIndex)}>
      <Ariakit.TabList className={cn('flex w-full items-center gap-2', className)}>
        {steps.map((step, index) => {
          const isCompleted = step.state === 'completed';
          const isActive = step.state === 'active';
          const isDisabled = mode === 'linear' && step.state === 'upcoming';

          return (
            <Ariakit.Tab
              key={getStepId(index)}
              id={getStepId(index)}
              disabled={isDisabled}
              className={cn(
                'group inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isCompleted && 'border-success bg-success-1 text-success',
                isActive && 'border-primary bg-primary text-primary-foreground',
                !isCompleted && !isActive && 'border-border bg-background text-muted-foreground',
                isDisabled && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => {
                if (isDisabled) return;
                onStepChange?.(index);
              }}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs',
                  isCompleted && 'border-success bg-success text-success-foreground',
                  isActive && 'border-primary-foreground bg-primary-foreground text-primary',
                  !isCompleted && !isActive && 'border-muted-foreground/40',
                )}
              >
                {isCompleted ? '✓' : index + 1}
              </span>
              <span>{step.label}</span>
            </Ariakit.Tab>
          );
        })}
      </Ariakit.TabList>
    </Ariakit.TabProvider>
  );
};
