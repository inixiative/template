import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { setupRailwayPostgres } from '../tasks/railwayPostgresSetup';
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';

type RailwayPostgresSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

type Status = 'idle' | 'running' | 'done' | 'error';

export const RailwayPostgresSetupView: React.FC<RailwayPostgresSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);

  const stagingEnabled = config?.features.staging.enabled ?? true;
  const totalSteps = stagingEnabled ? 4 : 2;

  const run = useCallback(async () => {
    setStatus('running');
    setError(null);
    try {
      await setupRailwayPostgres(async () => {
        setStepCount((c) => c + 1);
        await syncConfig();
      });
      await syncConfig();
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      await syncConfig();
    }
  }, [syncConfig]);

  // Auto-start on mount.
  useEffect(() => {
    if (status === 'idle') run();
  }, [status, run]);

  useInput((_input, key) => {
    if (status === 'running') return;
    if (key.escape) onCancel();
    if (key.return) {
      if (status === 'done') onComplete();
      else if (status === 'error') run();
    }
  });

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  const progress = config.railwayPostgres.progress;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Railway Postgres Setup
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Provisions Postgres databases via the Railway CLI ({stagingEnabled ? 'prod + staging' : 'prod only'}) and
          stores DATABASE_URL in Infisical at /api.
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1} marginLeft={2}>
        <Text color={progress.ensureProdPostgresService ? 'green' : 'cyan'}>
          {progress.ensureProdPostgresService ? '✓' : '·'} Provision prod Postgres service
        </Text>
        <Text color={progress.storeProdPostgresUrl ? 'green' : 'cyan'}>
          {progress.storeProdPostgresUrl ? '✓' : '·'} Store prod DATABASE_URL in Infisical
        </Text>
        {stagingEnabled && (
          <>
            <Text color={progress.ensureStagingPostgresService ? 'green' : 'cyan'}>
              {progress.ensureStagingPostgresService ? '✓' : '·'} Provision staging Postgres service
            </Text>
            <Text color={progress.storeStagingPostgresUrl ? 'green' : 'cyan'}>
              {progress.storeStagingPostgresUrl ? '✓' : '·'} Store staging DATABASE_URL in Infisical
            </Text>
          </>
        )}
      </Box>

      {status === 'running' && (
        <Box marginBottom={1}>
          <Text color="cyan">Working… ({stepCount}/{totalSteps})</Text>
        </Box>
      )}

      {status === 'done' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>
            ✓ Postgres ready — DATABASE_URL stored in Infisical for {stagingEnabled ? 'prod + staging' : 'prod'}.
          </Text>
          <Box marginTop={1}>
            <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
          </Box>
        </Box>
      )}

      {status === 'error' && error && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="red">✗ {error}</Text>
          <Box marginTop={1}>
            <Text dimColor>Enter to retry. Esc to go back.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default RailwayPostgresSetupView;
