import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StepProgress } from '../components/StepProgress';
import { setupRailwayBuckets } from '../tasks/railwayBucketsSetup';
import { getRailwayBucketsProgressItems } from '../tasks/railwayBucketsSteps';
import { updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import { clearError, clearProgress } from '../utils/progressTracking';
import { prompt } from '../utils/prompts';

type RailwayBucketsSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

type SetupState = 'new' | 'incomplete' | 'complete';

export const RailwayBucketsSetupView: React.FC<RailwayBucketsSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectState = (): SetupState => {
    if (!config) return 'new';
    const items = getRailwayBucketsProgressItems(config);
    if (items.every((item) => item.completed || item.skipped)) return 'complete';
    if (items.some((item) => item.completed)) return 'incomplete';
    return 'new';
  };
  const setupState = detectState();

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      await setupRailwayBuckets(syncConfig);
      await syncConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await syncConfig();
    } finally {
      setRunning(false);
    }
  }, [syncConfig]);

  const handleRestart = useCallback(async () => {
    await clearProgress('railwayBuckets');
    await clearError('railwayBuckets');
    await updateConfigField('railwayBuckets', 'prodSystemServiceId', '');
    await updateConfigField('railwayBuckets', 'prodUserServiceId', '');
    await updateConfigField('railwayBuckets', 'stagingSystemServiceId', '');
    await updateConfigField('railwayBuckets', 'stagingUserServiceId', '');
    await syncConfig();
    await handleRun();
  }, [handleRun, syncConfig]);

  useInput((input, key) => {
    if (running) return;
    if (key.escape) return onCancel();
    if (key.return) {
      if (setupState === 'new') return handleRun();
      return onComplete();
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
  const progressItems = getRailwayBucketsProgressItems(config);
  const projectName = config.project.name;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Railway Buckets Setup
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>
          Creates S3-compatible Railway Buckets via GraphQL and captures their per-environment credentials into
          Infisical at /api. Bucket creation is fully automated — no manual UI steps required.
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Buckets to provision:</Text>
        <Text>  • {projectName}-prod-system</Text>
        <Text>  • {projectName}-prod-user</Text>
        {stagingEnabled && (
          <>
            <Text>  • {projectName}-staging-system</Text>
            <Text>  • {projectName}-staging-user</Text>
          </>
        )}
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
            ✓ Buckets ready — STORAGE_* secrets stored in Infisical for {stagingEnabled ? 'prod + staging' : 'prod'}.
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
