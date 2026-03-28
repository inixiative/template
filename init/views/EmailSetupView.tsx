import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { ResendDomain } from '../api/resend';
import {
  confirmDnsSetup,
  getInfisicalProjectId,
  registerDomain,
  storeFromAddress,
  storeResendApiKey,
} from '../tasks/emailSetup';
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';

type ViewState =
  | 'loading'
  | 'prompt-api-key'
  | 'prompt-from'
  | 'confirm'
  | 'executing-secrets'
  | 'executing-domain'
  | 'dns-records'
  | 'complete';

type EmailSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

export const EmailSetupView: React.FC<EmailSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [apiKey, setApiKey] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [projectId, setProjectId] = useState('');
  const [domain, setDomain] = useState<ResendDomain | null>(null);
  const [error, setError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape && viewState !== 'executing-secrets' && viewState !== 'executing-domain') {
      onCancel();
    } else if (key.return && viewState === 'complete') {
      onComplete();
    }
  });

  useEffect(() => {
    const init = async () => {
      try {
        const id = await getInfisicalProjectId();
        setProjectId(id);

        // Resume: skip completed steps
        if (config?.email.progress.confirmDns) {
          setViewState('complete');
          return;
        }
        if (config?.email.progress.addDomain) {
          setViewState('dns-records');
          return;
        }
        if (config?.email.fromAddress) setFromAddress(config.email.fromAddress);
        setViewState('prompt-api-key');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Initialization failed');
      }
    };

    setTimeout(() => init(), 100);
  }, [config]);

  const handleApiKeySubmit = (value: string) => {
    if (!value.trim()) return;
    setApiKey(value.trim());
    setViewState('prompt-from');
  };

  const handleFromSubmit = (value: string) => {
    if (!value.trim()) return;
    setFromAddress(value.trim());
    setViewState('confirm');
  };

  const handleConfirm = async () => {
    setViewState('executing-secrets');
    try {
      await storeResendApiKey(projectId, apiKey);
      await storeFromAddress(projectId, fromAddress);
      await syncConfig();

      setViewState('executing-domain');
      const result = await registerDomain(apiKey, fromAddress);
      setDomain(result);
      await syncConfig();

      setViewState('dns-records');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    }
  };

  const handleDnsConfirm = async () => {
    try {
      await confirmDnsSetup(fromAddress);
      await syncConfig();
      setViewState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm DNS');
    }
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">✗ Error: {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      </Box>
    );
  }

  if (viewState === 'loading') {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (viewState === 'prompt-api-key') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Resend Setup</Text>
        </Box>
        <Text dimColor>Get your API key from resend.com/api-keys</Text>
        <Box marginTop={1}>
          <Text>Resend API key: </Text>
          <TextInput value={apiKey} onChange={setApiKey} onSubmit={handleApiKeySubmit} mask="*" />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  if (viewState === 'prompt-from') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Resend Setup</Text>
        </Box>
        <Text dimColor>The address your emails will be sent from (e.g. noreply@yourdomain.com)</Text>
        <Box marginTop={1}>
          <Text>From address: </Text>
          <TextInput value={fromAddress} onChange={setFromAddress} onSubmit={handleFromSubmit} />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  if (viewState === 'confirm') {
    const domainName = fromAddress.split('@')[1] ?? fromAddress;
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Confirm Email Setup</Text>
        </Box>
        <Text>• Store API key in Infisical (prod + staging)</Text>
        <Text>
          • Store from address: <Text color="cyan">{fromAddress}</Text>
        </Text>
        <Text>
          • Register domain <Text color="cyan">{domainName}</Text> with Resend
        </Text>
        <Text>• Show DNS records to configure</Text>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
        <TextInput value="" onChange={() => {}} onSubmit={handleConfirm} />
      </Box>
    );
  }

  if (viewState === 'executing-secrets') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          <Spinner type="dots" /> Storing secrets in Infisical...
        </Text>
      </Box>
    );
  }

  if (viewState === 'executing-domain') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">✓ Secrets stored</Text>
        <Text>
          <Spinner type="dots" /> Registering domain with Resend...
        </Text>
      </Box>
    );
  }

  if (viewState === 'dns-records') {
    const records = domain?.records ?? [];
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>DNS Records</Text>
        </Box>
        <Text dimColor>
          Add these records to your DNS provider for <Text color="cyan">{fromAddress.split('@')[1]}</Text>:
        </Text>
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {records.map((r) => (
            <Box key={`${r.type}-${r.name}`} flexDirection="column" marginBottom={1}>
              <Text>
                <Text color="yellow">{r.type}</Text>
                {'  '}
                <Text dimColor>Name:</Text> {r.name}
              </Text>
              <Text>
                {'     '}
                <Text dimColor>Value:</Text> {r.value}
              </Text>
              {r.priority !== undefined && (
                <Text>
                  {'     '}
                  <Text dimColor>Priority:</Text> {r.priority}
                </Text>
              )}
            </Box>
          ))}
          {records.length === 0 && <Text dimColor>No DNS records returned — check Resend dashboard.</Text>}
        </Box>
        <Text dimColor>Once DNS is configured, press Enter to confirm.</Text>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
        <TextInput value="" onChange={() => {}} onSubmit={handleDnsConfirm} />
      </Box>
    );
  }

  if (viewState === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">✓ Resend configured</Text>
        <Text color="green">✓ API key stored in Infisical</Text>
        <Text color="green">✓ From address stored in Infisical</Text>
        <Text color="green">✓ DNS records confirmed</Text>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter'])}</Text>
        </Box>
      </Box>
    );
  }

  return null;
};
