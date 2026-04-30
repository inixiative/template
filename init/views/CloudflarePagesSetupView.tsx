import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { type CFAccount, cloudflareApi } from '../api/cloudflare';
import { StepProgress } from '../components/StepProgress';
import { setupCloudflarePages } from '../tasks/cloudflarePagesSetup';
import { getCloudflarePagesProgressItems } from '../tasks/cloudflarePagesSteps';
import { useConfig } from '../utils/configState';
import { clearError, clearProgress } from '../utils/progressTracking';
import { prompt } from '../utils/prompts';

type Props = { onComplete: () => void; onCancel: () => void };

type ViewState = 'token-prompt' | 'account-select' | 'status';

export const CloudflarePagesSetupView: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [view, setView] = useState<ViewState>('token-prompt');
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState<string>('');
  const [accounts, setAccounts] = useState<CFAccount[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Skip the token prompt if storeApiToken is already complete (re-enter scenario).
  useEffect(() => {
    if (config?.cloudflarePages.progress.storeApiToken && config.cloudflarePages.accountId) {
      setAccountId(config.cloudflarePages.accountId);
      setView('status');
    }
  }, [config]);

  const submitToken = useCallback(async (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return setError('API token cannot be empty');
    setError(null);
    process.env.CLOUDFLARE_API_TOKEN = cleaned;
    try {
      await cloudflareApi.verifyToken();
      const accs = await cloudflareApi.listAccounts();
      if (accs.length === 0) throw new Error('Token has no associated CF accounts.');
      setToken(cleaned);
      setAccounts(accs);
      if (accs.length === 1) {
        setAccountId(accs[0].id);
        setView('status');
      } else {
        setView('account-select');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (!accountId || !token) return;
    setRunning(true);
    setError(null);
    try {
      await setupCloudflarePages(accountId, token, syncConfig);
      await syncConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await syncConfig();
    } finally {
      setRunning(false);
    }
  }, [accountId, token, syncConfig]);

  const handleRestart = useCallback(async () => {
    await clearProgress('cloudflarePages');
    await clearError('cloudflarePages');
    await syncConfig();
    setToken('');
    setAccountId('');
    setAccounts([]);
    setView('token-prompt');
  }, [syncConfig]);

  useInput((input, key) => {
    if (running) return;
    if (key.escape) return onCancel();
    if (view === 'status') {
      if (key.return) {
        // Dismiss when there's any progress already; trigger run on a fresh start.
        if (config?.cloudflarePages.progress.selectAccount) return onComplete();
        return handleRun();
      }
      if (input === 'r' || input === 'R') return handleRestart();
    }
  });

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (view === 'token-prompt') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold underline>
            Cloudflare Pages Setup
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Paste a Cloudflare API token with these permissions:</Text>
        </Box>
        <Box marginLeft={2} flexDirection="column" marginBottom={1}>
          <Text dimColor>• Account → Cloudflare Pages → Edit</Text>
          <Text dimColor>• Account → Account Settings → Read</Text>
          <Text dimColor>• User → User Details → Read</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Create one at: </Text>
          <Text color="cyan">https://dash.cloudflare.com/profile/api-tokens</Text>
        </Box>
        <Box>
          <Text>Token: </Text>
          <TextInput value={tokenInput} onChange={setTokenInput} onSubmit={submitToken} mask="*" />
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>Esc to cancel.</Text>
        </Box>
      </Box>
    );
  }

  if (view === 'account-select') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Select Cloudflare account</Text>
        </Box>
        <SelectInput
          items={accounts.map((a) => ({ label: `${a.name} (${a.id})`, value: a.id }))}
          onSelect={(item) => {
            setAccountId(item.value);
            setView('status');
          }}
        />
      </Box>
    );
  }

  // status view
  const progressItems = getCloudflarePagesProgressItems(config);
  const allDone = progressItems.every((i) => i.completed || i.skipped);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Cloudflare Pages Setup
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          Per-app Pages projects linked to GitHub. VITE_-prefixed env vars sync from Infisical at /{'<app>'}.
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
      {allDone && !running && (
        <Box marginBottom={1}>
          <Text color="green" bold>
            ✓ All Pages projects ready.
          </Text>
        </Box>
      )}
      {!running && (
        <Box>
          <Text dimColor>
            {allDone
              ? prompt(['enter', 'restart', 'cancel'])
              : config.cloudflarePages.progress.selectAccount
                ? prompt(['enter', 'restart', 'cancel'])
                : prompt(['enter', 'cancel'])}
          </Text>
        </Box>
      )}
    </Box>
  );
};
