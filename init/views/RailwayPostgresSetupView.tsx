import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StepProgress } from '../components/StepProgress';
import { setupRailwayPostgres } from '../tasks/railwayPostgresSetup';
import { getRailwayPostgresProgressItems } from '../tasks/railwayPostgresSteps';
import { updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import { clearError, clearProgress } from '../utils/progressTracking';
import { prompt } from '../utils/prompts';

type RailwayPostgresSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

type SetupState = 'new' | 'incomplete' | 'complete';

export const RailwayPostgresSetupView: React.FC<RailwayPostgresSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectState = (): SetupState => {
    if (!config) return 'new';
    const items = getRailwayPostgresProgressItems(config);
    if (items.every((item) => item.completed)) return 'complete';
    if (items.some((item) => item.completed)) return 'incomplete';
    return 'new';
  };
  const setupState = detectState();

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      await setupRailwayPostgres(syncConfig);
      await syncConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await syncConfig();
    } finally {
      setRunning(false);
    }
  }, [syncConfig]);

  const handleRestart = useCallback(async () => {
    await clearProgress('railwayPostgres');
    await clearError('railwayPostgres');
    await updateConfigField('railwayPostgres', 'prodServiceId', '');
    await updateConfigField('railwayPostgres', 'stagingServiceId', '');
    await syncConfig();
    await handleRun();
  }, [handleRun, syncConfig]);

  useInput((input, key) => {
    if (running) return;
    if (key.escape) return onCancel();
    if (key.return) {
      if (setupState === 'complete') return onComplete();
      return handleRun();
    }
    if (input === 'r' || input === 'R') return handleRestart();
  });

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  const stagingEnabled = config.features.staging.enabled;
  const progressItems = getRailwayPostgresProgressItems(config);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Railway Postgres Setup
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Provisions Postgres via Railway CLI ({stagingEnabled ? 'prod + staging' : 'prod only'}) and stores
          DATABASE_URL in Infisical at /api.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <StepProgress items={progressItems} running={running} marginLeft={2} />
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}

      {!running && setupState === 'complete' && (
        <Box marginBottom={1}>
          <Text color="green" bold>
            ✓ Postgres ready — DATABASE_URL stored in Infisical for {stagingEnabled ? 'prod + staging' : 'prod'}.
          </Text>
        </Box>
      )}

      {!running && (
        <Box>
          <Text dimColor>
            {setupState === 'complete'
              ? prompt(['enter', 'restart', 'cancel'])
              : setupState === 'incomplete'
                ? prompt(['enter', 'restart', 'cancel'])
                : prompt(['enter', 'cancel'])}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default RailwayPostgresSetupView;
