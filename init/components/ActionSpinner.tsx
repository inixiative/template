import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';

type ActionSpinnerProps = {
  /** Label shown next to the spinner (e.g. "Saving token...") */
  label: string | null;
};

/**
 * Inline spinner with a label — use when a non-core menu submit
 * triggers an async operation and the user needs visual feedback.
 *
 * Pair with useAsyncAction:
 * ```tsx
 * const { running, actionLabel } = useAsyncAction();
 * {running && <ActionSpinner label={actionLabel} />}
 * ```
 */
export const ActionSpinner: React.FC<ActionSpinnerProps> = ({ label }) => (
  <Box marginTop={1}>
    <Text color="cyan">
      <Spinner type="dots" /> {label ?? 'Processing...'}
    </Text>
  </Box>
);
