import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { type CicdConfig, loadCicdConfig } from '../../scripts/cicd/config';
import { configureCicd } from '../tasks/cicdSettings';
import { useConfig } from '../utils/configState';

export const CicdSetupView = ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => {
  const { syncConfig } = useConfig();
  const [config, setConfig] = useState<CicdConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingApprovals, setEditingApprovals] = useState(false);
  const [approvals, setApprovals] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadCicdConfig()
      .then(setConfig)
      .catch(() => setError('Unable to load cicd.config.ts. Check its syntax and settings.'));
  }, []);
  useInput((_input, key) => {
    if (key.escape && !busy) {
      if (editingApprovals) setEditingApprovals(false);
      else onCancel();
    }
  });
  const save = async (flag: string) => {
    setBusy(true);
    setError(null);
    try {
      setConfig(await configureCicd([flag]));
      await syncConfig();
      setEditingApprovals(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save delivery settings');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Delivery policy</Text>
      <Text dimColor>Saved to cicd.config.ts. Main deploys automatically after checks.</Text>
      <Text dimColor>Cloud workflow execution is not installed by this settings page.</Text>
      {error && <Text color="red">{error}</Text>}
      {busy ? (
        <Text>Saving…</Text>
      ) : editingApprovals ? (
        <Box>
          <Text>Required approvers (0 or more): </Text>
          <TextInput
            value={approvals}
            onChange={setApprovals}
            onSubmit={(value) => void save(`--approvals=${value}`)}
          />
        </Box>
      ) : config ? (
        <SelectInput
          items={[
            {
              label: `PR previews: ${config.pullRequests.deploy}`,
              value: `--pr=${config.pullRequests.deploy === 'auto' ? 'manual' : 'auto'}`,
            },
            {
              label: `Draft previews: ${config.pullRequests.drafts.deploy}`,
              value: `--drafts=${config.pullRequests.drafts.deploy === 'auto' ? 'manual' : 'auto'}`,
            },
            {
              label: `Staging: ${config.staging.enabled ? 'on' : 'off'}`,
              value: `--staging=${config.staging.enabled ? 'off' : 'on'}`,
            },
            { label: `Required merge approvals: ${config.pullRequests.requiredApprovals}`, value: 'approvals' },
            {
              label: `Bot approvals: ${config.pullRequests.allowBotApprovals ? 'allowed' : 'excluded'}`,
              value: `--bot-approvals=${config.pullRequests.allowBotApprovals ? 'off' : 'on'}`,
            },
            {
              label: `Database: ${config.database.strategy}`,
              value: `--database=${config.database.strategy === 'schema-push' ? 'migrations' : 'schema-push'}`,
            },
            { label: 'Done', value: 'done' },
          ]}
          onSelect={(item) => {
            if (item.value === 'done') return onComplete();
            if (item.value === 'approvals') {
              setApprovals(String(config.pullRequests.requiredApprovals));
              setEditingApprovals(true);
              return;
            }
            void save(item.value);
          }}
        />
      ) : !error ? (
        <Text>Loading…</Text>
      ) : null}
      <Text dimColor>Pre/post checks and cleanup on merge/close remain enabled. Esc to go back.</Text>
    </Box>
  );
};
