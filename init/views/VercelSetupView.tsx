import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { listTeams } from '../api/vercel';
import { ActionSpinner } from '../components/ActionSpinner';
import { type Organization, OrgSelector } from '../components/OrgSelector';
import { StepProgress } from '../components/StepProgress';
import { useAsyncAction } from '../components/useAsyncAction';
import { setupVercel } from '../tasks/vercelSetup';
import { getVercelProgressItems } from '../tasks/vercelSteps';
import { updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress } from '../utils/progressTracking';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'team-select' | 'github-prompt';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type VercelSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
  const { progress, configProjectName } = config.vercel;
  const currentProjectName = config.project.name;

  // Stale if project name changed
  if (configProjectName && configProjectName !== currentProjectName) {
    return 'stale';
  }

  // New if no progress
  const hasAnyProgress = Object.values(progress).some((v) => v === true);
  if (!hasAnyProgress) {
    return 'new';
  }

  // Complete if all steps done
  const allSteps = Object.values(progress);
  if (allSteps.every((v) => v === true)) {
    return 'complete';
  }

  // Incomplete otherwise
  return 'incomplete';
};

export const VercelSetupView: React.FC<VercelSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('status');
  const [running, setRunning] = useState(false);
  const [teams, setTeams] = useState<Organization[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const confirmAction = useAsyncAction();

  // Derive setup state from config
  const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);

  // Progress items
  const progressItems = useMemo(() => (config ? getVercelProgressItems(config) : []), [config]);

  // Load teams on mount
  useEffect(() => {
    const init = async () => {
      try {
        const vercelTeams = await listTeams();
        // Convert Vercel teams to Organization format for OrgSelector
        setTeams(
          vercelTeams.map((team) => ({
            id: team.id,
            name: team.name,
          })),
        );
      } catch (_err) {
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };

    init();
  }, []);

  // Handle keyboard input on status page
  useInput((input, key) => {
    if (viewState !== 'status' || running) return;

    if (key.escape) {
      onCancel();
    } else if (key.return) {
      // Enter: Complete, Continue, or Run setup
      if (setupState === 'complete') {
        onComplete();
      } else {
        handleAction(setupState === 'incomplete' ? 'continue' : 'run');
      }
    } else if (input.toLowerCase() === 'r') {
      // R: Restart
      handleAction('restart');
    }
  });

  // Handle input on GitHub prompt view
  useInput((_input, key) => {
    if (viewState !== 'github-prompt') return;

    if (key.return) {
      handleGithubConfirm();
    } else if (key.escape) {
      onCancel();
    }
  });

  const handleAction = async (action: 'run' | 'continue' | 'restart') => {
    if (!config || !teams || running) return;

    setRunning(true);

    if (action === 'restart') {
      // Clear progress, config, and errors
      await updateConfigField('vercel', 'teamId', '');
      await updateConfigField('vercel', 'teamName', '');
      await updateConfigField('vercel', 'connectionId', '');
      await updateConfigField('vercel', 'webProjectId', '');
      await updateConfigField('vercel', 'adminProjectId', '');
      await updateConfigField('vercel', 'superadminProjectId', '');
      await updateConfigField('vercel', 'configProjectName', '');
      await clearProgress('vercel');
      await clearError('vercel');

      // Refresh config
      await syncConfig();

      // Go to team select (or run immediately if 1 team)
      if (teams.length === 1) {
        await runSetup(teams[0].id!, teams[0].name);
      } else {
        setRunning(false);
        setViewState('team-select');
      }
      return;
    }

    if (action === 'continue' || action === 'run') {
      // Clear any previous errors
      await clearError('vercel');
      await syncConfig();

      // Try to use existing team from config first
      const existingTeamId = config.vercel?.teamId;
      const existingTeamName = config.vercel?.teamName || '';

      if (existingTeamId) {
        // Resume with existing team
        await runSetup(existingTeamId, existingTeamName);
      } else {
        // No team selected - go to team selection
        if (teams.length === 1) {
          await runSetup(teams[0].id!, teams[0].name);
        } else {
          setRunning(false);
          setViewState('team-select');
        }
      }
    }
  };

  const runSetup = async (teamId: string, teamName: string) => {
    setViewState('status');
    setRunning(true);

    try {
      await setupVercel(teamId, teamName, syncConfig);
      await syncConfig();
      setRunning(false);
    } catch (error) {
      // Check if it's a GitHub connection error
      if (
        error instanceof Error &&
        (error.message === 'GITHUB_NOT_CONNECTED' || error.message === 'GITHUB_NOT_INSTALLED')
      ) {
        // Show GitHub prompt
        setRunning(false);
        setViewState('github-prompt');
        await syncConfig();
        return;
      }

      // Other errors - persist and show
      setViewState('status');
      await syncConfig();
      setRunning(false);
    }
  };

  const handleTeamSelect = async (teamId: string) => {
    const team = teams?.find((t) => t.id === teamId);
    const teamName = team?.name || '';
    setRunning(true);
    await runSetup(teamId, teamName);
  };

  const handleGithubConfirm = async () => {
    if (!config) return;

    await confirmAction.run('Resuming setup...', async () => {
      await clearError('vercel');
      await syncConfig();

      const existingTeamId = config.vercel?.teamId;
      const existingTeamName = config.vercel?.teamName || '';
      if (existingTeamId) {
        setViewState('status');
        setRunning(true);
        await runSetup(existingTeamId, existingTeamName);
      }
    });
  };

  // Team selection view
  if (viewState === 'team-select') {
    return (
      <OrgSelector
        organizations={teams || []}
        serviceName="Vercel"
        loading={running}
        onSelect={handleTeamSelect}
        onCancel={onCancel}
      />
    );
  }

  // GitHub setup prompt view
  if (viewState === 'github-prompt') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
          <Box flexDirection="column">
            <Text bold color="cyan">
              GitHub Integration Required
            </Text>

            <Box marginTop={1}>
              <Text>Vercel projects are ready, but need GitHub connected to enable automatic deployments.</Text>
            </Box>

            <Box marginTop={1}>
              <Text bold>Install Vercel GitHub App:</Text>
            </Box>

            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              <Text>
                1. Visit: <Text color="cyan">https://github.com/apps/vercel</Text>
              </Text>
              <Text>2. Click "Configure" (or "Install" if not installed)</Text>
              <Text>
                3. Select organization: <Text color="yellow">{config?.project.organization}</Text>
              </Text>
              <Text>
                4. Grant access to repository: <Text color="yellow">{config?.project.name}</Text>
              </Text>
              <Text> (or select "All repositories" for convenience)</Text>
            </Box>

            <Box marginTop={1}>
              <Text dimColor>Press Enter when GitHub integration is configured</Text>
            </Box>

            {confirmAction.running ? (
              <ActionSpinner label={confirmAction.actionLabel} />
            ) : (
              <Box marginTop={1}>
                <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // Loading states
  if (!config || loadingTeams) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  // Status view (main screen)
  const error = config.vercel?.error;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Vercel Setup</Text>

      {/* Error Display */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ Error: {error}</Text>
        </Box>
      )}

      {/* Setup state indicator */}
      <Box marginTop={1}>
        {setupState === 'new' && <Text color="cyan">⚡ Ready to provision Vercel projects</Text>}
        {setupState === 'stale' && <Text color="yellow">⚠ Project name changed - setup needs to be restarted</Text>}
        {setupState === 'incomplete' && <Text color="yellow">⋯ Setup in progress - continue where you left off</Text>}
        {setupState === 'complete' && <Text color="green">✓ Vercel setup complete</Text>}
      </Box>

      {/* Progress list */}
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Progress:</Text>
        <StepProgress items={progressItems} running={running} marginLeft={2} />
      </Box>

      {/* Instructions */}
      {!running && (
        <Box flexDirection="column" marginTop={1}>
          {setupState === 'new' && <Text dimColor>{prompt(['enter', 'cancel'])}</Text>}
          {setupState === 'stale' && <Text dimColor>{prompt(['restart', 'cancel'])}</Text>}
          {setupState === 'incomplete' && <Text dimColor>{prompt(['enter', 'restart', 'cancel'])}</Text>}
          {setupState === 'complete' && <Text dimColor>{prompt(['enter', 'restart'])}</Text>}
        </Box>
      )}
    </Box>
  );
};
