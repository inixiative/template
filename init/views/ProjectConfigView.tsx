import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StepProgress } from '../components/StepProgress';
import { getCurrentConfig, renameProject, updateProjectConfig } from '../tasks/projectConfig';
import { getProjectProgressItems } from '../tasks/projectSteps';
import { clearAllProgress, setProgressComplete } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';

const execAsync = promisify(exec);

type ViewState = 'loading' | 'prompt-name' | 'prompt-org' | 'confirm' | 'executing' | 'complete';

type ProjectConfigViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

export const ProjectConfigView: React.FC<ProjectConfigViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [currentConfig, setCurrentConfig] = useState({ name: '', organization: '' });
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | undefined>(undefined);

  const progressItems = useMemo(() => {
    if (!config) return [];
    return getProjectProgressItems(config);
  }, [config]);

  useInput((_input, key) => {
    if (key.escape && viewState !== 'executing' && viewState !== 'complete') {
      onCancel();
    } else if (key.return && viewState === 'complete') {
      onComplete();
    }
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await getCurrentConfig();
        setCurrentConfig(cfg);
        setNewName(cfg.name);
        setNewOrg(cfg.organization);
        setViewState('prompt-name');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config');
      }
    };

    setTimeout(() => loadConfig(), 100);
  }, []);

  const handleNameSubmit = (value: string) => {
    setNewName(value || currentConfig.name);
    setViewState('prompt-org');
  };

  const handleOrgSubmit = (value: string) => {
    setNewOrg(value || currentConfig.organization);
    setViewState('confirm');
  };

  const onStepComplete = useCallback(
    async (action?: string) => {
      setActiveAction(action);
      await syncConfig();
    },
    [syncConfig],
  );

  const handleConfirm = async () => {
    setViewState('executing');

    try {
      // Reset all project progress for a clean run
      await clearAllProgress('project');
      await onStepComplete();

      await updateProjectConfig({ name: newName, organization: newOrg });

      if (newOrg && newOrg.trim() !== '') {
        await setProgressComplete('project', 'renameOrg');
        await onStepComplete();
      }

      if (newName !== currentConfig.name) {
        await renameProject(currentConfig.name, newName, onStepComplete);
      }

      // bun run setup (Docker, Prisma generate, etc.)
      await execAsync('bun run setup');
      await setProgressComplete('project', 'setup');
      await onStepComplete();

      setViewState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
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
        <Text>
          <Spinner type="dots" /> Loading current configuration...
        </Text>
      </Box>
    );
  }

  if (viewState === 'prompt-name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Project Configuration</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Current Configuration:</Text>
          <Text> Name: {currentConfig.name}</Text>
          <Text> Organization: {currentConfig.organization}</Text>
        </Box>

        <Box>
          <Text>Project name: </Text>
          <TextInput value={newName} onChange={setNewName} onSubmit={handleNameSubmit} />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  if (viewState === 'prompt-org') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Project Configuration</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Current Configuration:</Text>
          <Text> Name: {newName}</Text>
          <Text> Organization: {currentConfig.organization}</Text>
        </Box>

        <Box>
          <Text>Organization: </Text>
          <TextInput value={newOrg} onChange={setNewOrg} onSubmit={handleOrgSubmit} />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  if (viewState === 'confirm') {
    const nameChanging = newName !== currentConfig.name;
    const orgChanging = newOrg !== currentConfig.organization;
    const anyChanges = nameChanging || orgChanging;

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Confirm Changes</Text>
        </Box>

        {!anyChanges && (
          <Box marginBottom={1}>
            <Text color="yellow">No changes</Text>
          </Box>
        )}

        {anyChanges && (
          <Box flexDirection="column" marginBottom={1}>
            {nameChanging && (
              <Text>
                • Name: <Text color="red">{currentConfig.name}</Text> → <Text color="green">{newName}</Text>
              </Text>
            )}
            {orgChanging && (
              <Text>
                • Org: <Text color="red">{currentConfig.organization}</Text> → <Text color="green">{newOrg}</Text>
              </Text>
            )}
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>

        <TextInput value="" onChange={() => {}} onSubmit={handleConfirm} />
      </Box>
    );
  }

  if (viewState === 'executing') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>
            Renaming to <Text color="green">{newName}</Text>
          </Text>
        </Box>
        <StepProgress items={progressItems} running={true} activeAction={activeAction} />
      </Box>
    );
  }

  if (viewState === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <StepProgress items={progressItems} running={false} />
        <Box marginTop={1}>
          <Text color="green">✓ Project configured!</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter'])}</Text>
        </Box>
      </Box>
    );
  }

  return null;
};
