import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';

export type ProgressItem = {
  label: string;
  completed: boolean;
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
  const currentStepIndex = running ? items.findIndex((item) => !item.completed) : -1;

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const isCompleted = item.completed;
        const isInProgress = running && i === currentStepIndex;
        const isPending = !isCompleted && !isInProgress;

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
