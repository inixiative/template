import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useMemo, useState } from 'react';
import { StepProgress } from '../components/StepProgress';
import {
  confirmResendDnsSetup,
  ensureResendDomain,
  getInfisicalProjectId,
  storeResendApiKey,
  storeResendFromAddress,
} from '../tasks/resendSetup';
import { getResendProgressItems } from '../tasks/resendSteps';
import { updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import { getProjectConfig, type ProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress, setError } from '../utils/progressTracking';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'api-key-input' | 'from-input' | 'dns-records';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type ResendSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

const hasStoredApiKey = (progress: ProjectConfig['resend']['progress']): boolean => {
  return progress.storeProdApiKey && progress.storeStagingApiKey;
};

const hasStoredFromAddress = (progress: ProjectConfig['resend']['progress']): boolean => {
  return progress.storeProdFromAddress && progress.storeStagingFromAddress;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
  const { progress, configProjectName } = config.resend;
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

export const ResendSetupView: React.FC<ResendSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('status');
  const [running, setRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [dnsRecords, setDnsRecords] = useState<
    Array<{
      type: string;
      name: string;
      value: string;
      priority?: number;
    }>
  >([]);
  const [activeAction, setActiveAction] = useState<string | undefined>(undefined);

  const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);
  const progressItems = useMemo(() => (config ? getResendProgressItems(config) : []), [config]);
  const error = config?.resend.error ?? '';

  const restartSetup = async () => {
    await updateConfigField('resend', 'fromAddress', '');
    await updateConfigField('resend', 'domainId', '');
    await updateConfigField('resend', 'configProjectName', '');
    await clearProgress('resend');
    await clearError('resend');
    await syncConfig();
    setApiKey('');
    setFromAddress('');
    setDnsRecords([]);
    setActiveAction(undefined);
    setViewState('status');
  };

  const showDnsRecords = async (currentFromAddress: string) => {
    const projectId = await getInfisicalProjectId();
    setRunning(true);
    setActiveAction('Loading domain details from Resend...');

    try {
      const domain = await ensureResendDomain(projectId, currentFromAddress);
      setFromAddress(currentFromAddress);
      setDnsRecords(
        domain.records.map((record) => ({
          type: record.type,
          name: record.name,
          value: record.value,
          priority: record.priority,
        })),
      );
      await syncConfig();
      setViewState('dns-records');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to load domain details';
      await setError('resend', message);
      await syncConfig();
      setViewState('status');
    } finally {
      setRunning(false);
      setActiveAction(undefined);
    }
  };

  const runSetup = async (nextFromAddress: string) => {
    if (!config) return;

    setRunning(true);
    setActiveAction(undefined);
    setViewState('status');

    try {
      if (setupState === 'stale') {
        await updateConfigField('resend', 'domainId', '');
        await clearProgress('resend');
      }

      await clearError('resend');
      await syncConfig();

      const projectId = await getInfisicalProjectId();
      const latestConfig = await getProjectConfig();
      const resendProgress = latestConfig.resend.progress;

      if (!hasStoredApiKey(resendProgress)) {
        if (!apiKey) {
          throw new Error('Resend API key is required.');
        }

        setActiveAction('Storing API key in Infisical...');
        await storeResendApiKey(projectId, apiKey);
        await syncConfig();
      }

      if (!hasStoredFromAddress(resendProgress)) {
        if (!nextFromAddress) {
          throw new Error('From address is required.');
        }

        setActiveAction('Storing from address in Infisical...');
        await storeResendFromAddress(projectId, nextFromAddress);
        await syncConfig();
      }

      setActiveAction('Registering domain with Resend...');
      const domain = await ensureResendDomain(projectId, nextFromAddress, apiKey || undefined);
      setFromAddress(nextFromAddress);
      setDnsRecords(
        domain.records.map((record) => ({
          type: record.type,
          name: record.name,
          value: record.value,
          priority: record.priority,
        })),
      );
      await syncConfig();
      setViewState('dns-records');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Resend setup failed';
      await setError('resend', message);
      await syncConfig();
      setViewState('status');
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

    const currentFromAddress = config.resend.fromAddress || fromAddress;
    const progress = config.resend.progress;

    if (setupState === 'stale') {
      await runSetup(currentFromAddress);
      return;
    }

    if (progress.addDomain && !progress.confirmDns) {
      if (!currentFromAddress) {
        setViewState('from-input');
        return;
      }

      await showDnsRecords(currentFromAddress);
      return;
    }

    if (!hasStoredApiKey(progress)) {
      setViewState('api-key-input');
      return;
    }

    if (!hasStoredFromAddress(progress) || !currentFromAddress) {
      setFromAddress(currentFromAddress);
      setViewState('from-input');
      return;
    }

    await runSetup(currentFromAddress);
  };

  const handleApiKeySubmit = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    setApiKey(trimmedValue);
    const currentFromAddress = config?.resend.fromAddress || fromAddress;
    if (currentFromAddress) {
      await runSetup(currentFromAddress);
      return;
    }

    setViewState('from-input');
  };

  const handleFromSubmit = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    setFromAddress(trimmedValue);
    await runSetup(trimmedValue);
  };

  const handleDnsConfirm = async () => {
    const currentFromAddress = config?.resend.fromAddress || fromAddress;
    if (!currentFromAddress) {
      await setError('resend', 'From address is missing. Restart Resend setup.');
      await syncConfig();
      setViewState('status');
      return;
    }

    try {
      await clearError('resend');
      await confirmResendDnsSetup(currentFromAddress);
      await syncConfig();
      setViewState('status');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to confirm DNS';
      await setError('resend', message);
      await syncConfig();
      setViewState('status');
    }
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

    if (viewState === 'dns-records') {
      if (key.escape) {
        onCancel();
      } else if (key.return) {
        void handleDnsConfirm();
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
      <Text bold>Resend Setup</Text>

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
          <Text color="yellow">⚠ Project name changed - Resend setup needs to be rerun</Text>
        </Box>
      )}

      {viewState === 'status' && setupState === 'new' && !running && (
        <Box marginTop={1}>
          <Text dimColor>No Resend domain configured</Text>
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
          <Text dimColor>Get your API key from resend.com/api-keys</Text>
          <Box marginTop={1}>
            <Text>Resend API key: </Text>
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

      {viewState === 'from-input' && !running && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>The address your emails will be sent from (e.g. noreply@yourdomain.com)</Text>
          <Box marginTop={1}>
            <Text>From address: </Text>
            <TextInput
              value={fromAddress}
              onChange={setFromAddress}
              onSubmit={(value) => void handleFromSubmit(value)}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
          </Box>
        </Box>
      )}

      {viewState === 'dns-records' && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>DNS Records</Text>
          <Text dimColor>
            Add these records to your DNS provider for <Text color="cyan">{fromAddress.split('@')[1]}</Text>:
          </Text>
          <Box flexDirection="column" marginTop={1} marginBottom={1}>
            {dnsRecords.map((record) => (
              <Box key={`${record.type}-${record.name}`} flexDirection="column" marginBottom={1}>
                <Text>
                  <Text color="yellow">{record.type}</Text>
                  {'  '}
                  <Text dimColor>Name:</Text> {record.name}
                </Text>
                <Text>
                  {'     '}
                  <Text dimColor>Value:</Text> {record.value}
                </Text>
                {record.priority !== undefined && (
                  <Text>
                    {'     '}
                    <Text dimColor>Priority:</Text> {record.priority}
                  </Text>
                )}
              </Box>
            ))}
            {dnsRecords.length === 0 && <Text dimColor>No DNS records returned - check Resend dashboard.</Text>}
          </Box>
          <Text dimColor>Once DNS is configured, press Enter to confirm.</Text>
          <Box marginTop={1}>
            <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
