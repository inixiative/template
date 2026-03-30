import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useMemo, useState } from 'react';
import { StepProgress } from '../components/StepProgress';
import { storeBouncerApiKey } from '../tasks/bouncerSetup';
import { getBouncerProgressItems } from '../tasks/bouncerSteps';
import { updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress, setError } from '../utils/progressTracking';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'api-key-input';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type BouncerSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
  const { progress, configProjectName } = config.bouncer;
  const currentProjectName = config.project.name;

  if (configProjectName && configProjectName !== currentProjectName) {
    return 'stale';
  }

  const hasAnyProgress = Object.values(progress).some((value) => value === true);
  if (!hasAnyProgress) {
    return 'new';
  }

  const allSteps = Object.values(progress);
  if (allSteps.every((value) => value === true)) {
    return 'complete';
  }

  return 'incomplete';
};

export const BouncerSetupView: React.FC<BouncerSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('status');
  const [running, setRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [activeAction, setActiveAction] = useState<string | undefined>(undefined);

  const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);
  const progressItems = useMemo(() => (config ? getBouncerProgressItems(config) : []), [config]);
  const error = config?.bouncer.error ?? '';

  const restartSetup = async () => {
    await updateConfigField('bouncer', 'configProjectName', '');
    await clearProgress('bouncer');
    await clearError('bouncer');
    await syncConfig();
    setApiKey('');
    setActiveAction(undefined);
    setViewState('status');
  };

  const runSetup = async (key: string) => {
    if (!config) return;

    setRunning(true);
    setActiveAction('Storing API key in Infisical...');
    setViewState('status');

    try {
      await clearError('bouncer');
      await storeBouncerApiKey(key);
      await syncConfig();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Bouncer setup failed';
      await setError('bouncer', message);
      await syncConfig();
    } finally {
      setRunning(false);
      setActiveAction(undefined);
    }
  };

  const handleAction = async (action: 'run' | 'continue' | 'restart') => {
    if (!config) return;

    if (action === 'restart') {
      await restartSetup();
      return;
    }

    if (setupState === 'stale') {
      await restartSetup();
    }

    if (!config.bouncer.progress.storeApiKey) {
      setViewState('api-key-input');
      return;
    }

    // Already complete
    await runSetup(apiKey);
  };

  const handleApiKeySubmit = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    setApiKey(trimmedValue);
    await runSetup(trimmedValue);
  };

  useInput((input, key) => {
    if (running) return;

    if (viewState === 'status') {
      if (key.escape) {
        onCancel();
      } else if (key.return) {
        if (setupState === 'complete') {
          onComplete();
        } else {
          void handleAction(setupState === 'incomplete' ? 'continue' : 'run');
        }
      } else if (input.toLowerCase() === 'r') {
        void handleAction('restart');
      }
      return;
    }

    if (key.escape) {
      onCancel();
    }
  });

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Bouncer Setup</Text>

      {error && (
        <Box marginTop={1} marginBottom={1}>
          <Text color="red" bold>
            ✗ Error: {error}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <StepProgress items={progressItems} running={running} activeAction={activeAction} />
      </Box>

      {viewState === 'status' && setupState === 'stale' && (
        <Box marginTop={1}>
          <Text color="yellow">⚠ Project name changed - Bouncer setup needs to be rerun</Text>
        </Box>
      )}

      {viewState === 'status' && setupState === 'new' && !running && (
        <Box marginTop={1}>
          <Text dimColor>No Bouncer API key configured</Text>
        </Box>
      )}

      {viewState === 'status' && !running && (
        <Box marginTop={1}>
          <Text dimColor>
            {setupState === 'new' || setupState === 'stale'
              ? prompt(['enter', 'cancel'])
              : setupState === 'incomplete'
                ? prompt(['enter', 'restart', 'cancel'])
                : prompt(['enter', 'restart'])}
          </Text>
        </Box>
      )}

      {viewState === 'api-key-input' && !running && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Get your API key from usebouncer.com/dashboard/api-keys</Text>
          <Box marginTop={1}>
            <Text>Bouncer API key: </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={(value) => void handleApiKeySubmit(value)}
              mask="*"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
