import { useCallback, useState } from 'react';

type AsyncActionState = {
  /** Whether the async action is currently running */
  running: boolean;
  /** Error message if the action failed, null otherwise */
  error: string | null;
  /** Label describing the current action (shown next to spinner) */
  actionLabel: string | null;
};

type AsyncActionReturn = AsyncActionState & {
  /** Execute an async action with a loading label. Sets running=true, clears on completion/error. */
  run: (label: string, action: () => Promise<void>) => Promise<void>;
  /** Clear the error state */
  clearError: () => void;
};

/**
 * Hook for tracking async action state with loading indicators.
 *
 * Use this in views where a submit/confirm triggers an async operation
 * and you need a spinner + label while it runs.
 *
 * @example
 * ```tsx
 * const { running, error, actionLabel, run } = useAsyncAction();
 *
 * const handleSubmit = () => run('Saving token...', async () => {
 *   await setSecretAsync(projectId, env, key, value);
 * });
 *
 * // In render:
 * {running && <ActionSpinner label={actionLabel} />}
 * {error && <Text color="red">{error}</Text>}
 * ```
 */
export const useAsyncAction = (): AsyncActionReturn => {
  const [state, setState] = useState<AsyncActionState>({
    running: false,
    error: null,
    actionLabel: null,
  });

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    setState({ running: true, error: null, actionLabel: label });
    try {
      await action();
      setState({ running: false, error: null, actionLabel: null });
    } catch (err) {
      setState({
        running: false,
        error: err instanceof Error ? err.message : 'Action failed',
        actionLabel: null,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { ...state, run, clearError };
};
