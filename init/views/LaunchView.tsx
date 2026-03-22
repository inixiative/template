import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type PreflightCheck, executeLaunch, runPreflightChecks } from '../tasks/launch';
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';

type ViewState = 'preflight' | 'confirm' | 'launching' | 'complete' | 'blocked';

type LaunchViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

export const LaunchView: React.FC<LaunchViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('preflight');
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [error, setError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape && viewState !== 'launching') {
      onCancel();
    }
    if (key.return && viewState === 'confirm') {
      handleLaunch();
    }
    if (key.return && viewState === 'complete') {
      onComplete();
    }
    if (key.return && viewState === 'blocked') {
      onCancel();
    }
  });

  // Run preflight checks on mount
  useEffect(() => {
    if (!config) return;

    const { checks: results, allPassed } = runPreflightChecks(config);
    setChecks(results);
    setViewState(allPassed ? 'confirm' : 'blocked');
  }, [config]);

  const handleLaunch = async () => {
    setViewState('launching');
    try {
      await executeLaunch();
      await syncConfig();
      setViewState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    }
  };

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Launch failed: {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  // Show preflight results + blocked or confirm
  if (viewState === 'preflight' || viewState === 'blocked' || viewState === 'confirm') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Launch Preflight Checks</Text>
        </Box>

        {checks.map((check) => (
          <Box key={check.label}>
            <Text color={check.passed ? 'green' : 'red'}>
              {check.passed ? '  ✓' : '  ✗'} {check.label}
            </Text>
            {check.detail && !check.passed && <Text dimColor> — {check.detail}</Text>}
          </Box>
        ))}

        <Box marginTop={1}>
          {viewState === 'blocked' && (
            <Box flexDirection="column">
              <Text color="yellow">
                Fix the failing checks above before launching.
              </Text>
              <Box marginTop={1}>
                <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
              </Box>
            </Box>
          )}
          {viewState === 'confirm' && (
            <Box flexDirection="column">
              <Text color="cyan" bold>
                All checks passed. Ready to launch.
              </Text>
              <Text dimColor>
                This will set launched=true in project.config.ts.
              </Text>
              <Text dimColor>
                After launch: db:push and db:seed are blocked in setup.sh.
              </Text>
              <Text dimColor>
                Use db:migrate for schema changes instead.
              </Text>
              <Box marginTop={1}>
                <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  if (viewState === 'launching') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          <Spinner type="dots" /> Launching...
        </Text>
      </Box>
    );
  }

  if (viewState === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>✓ Launched!</Text>
        <Text color="green">  project.config.ts updated: launched = true</Text>
        <Box marginTop={1}>
          <Text dimColor>
            From now on, use db:migrate for schema changes.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter'])}</Text>
        </Box>
      </Box>
    );
  }

  return null;
};
