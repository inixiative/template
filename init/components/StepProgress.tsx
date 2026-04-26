import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';

export type ProgressItem = {
  label: string;
  completed: boolean;
  /** When true, the step is intentionally not run (e.g. staging when staging
   *  is disabled). Rendered with ⊘ + "(skipped)" so users can still see what
   *  WOULD happen if the relevant feature were enabled. */
  skipped?: boolean;
};

type StepProgressProps = {
  items: ProgressItem[];
  running: boolean;
  /** Optional sub-status text shown below the active step (e.g., "Retrying... attempt 3/100") */
  activeAction?: string;
  /** Optional left margin for each step row */
  marginLeft?: number;
};

/**
 * Reusable step-by-step progress display.
 *
 * Shows all steps upfront with status indicators:
 *   ✓ completed steps (green)
 *   ⠹ current step with animated spinner (cyan)
 *       └ optional active action sub-label
 *   − pending steps (dimmed)
 */
export const StepProgress: React.FC<StepProgressProps> = ({ items, running, activeAction, marginLeft = 0 }) => {
  // Skipped items don't affect progression — find the next non-skipped, non-completed step.
  const currentStepIndex = running
    ? items.findIndex((item) => !item.completed && !item.skipped)
    : -1;

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const isSkipped = item.skipped === true;
        const isCompleted = !isSkipped && item.completed;
        const isInProgress = !isSkipped && running && i === currentStepIndex;
        const isPending = !isCompleted && !isInProgress && !isSkipped;

        return (
          <Box key={item.label} flexDirection="column" marginLeft={marginLeft}>
            <Box>
              {isCompleted && <Text color="green">✓ {item.label}</Text>}
              {isInProgress && (
                <Text color="cyan">
                  <Spinner type="dots" /> {item.label}
                </Text>
              )}
              {isPending && <Text dimColor>− {item.label}</Text>}
              {isSkipped && (
                <Text color="yellow" dimColor>
                  ⊘ {item.label} (skipped)
                </Text>
              )}
            </Box>
            {isInProgress && activeAction && (
              <Box marginLeft={4}>
                <Text dimColor>↳ {activeAction}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
