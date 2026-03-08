import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { listTeams } from '../api/vercel';
import { type Organization, OrgSelector } from '../components/OrgSelector';
import { setupVercel } from '../tasks/vercelSetup';
import { clearAllProgress, clearConfigError, updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
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

const getProgressDisplay = (config: ProjectConfig): Array<{ label: string; completed: boolean }> => {
  const { progress, teamId, webProjectId, adminProjectId, superadminProjectId } = config.vercel;

  return [
    {
      label: teamId ? `Team selected: ${teamId}` : 'Team selected',
      completed: progress.selectTeam,
    },
    // Web app
    {
      label: webProjectId ? `Web: Project created (${webProjectId})` : 'Web: Project created',
      completed: progress.createWebProject,
    },
    {
      label: 'Web: Root directory configured',
      completed: progress.configureWebRootDirectory,
    },
    {
      label: 'Web: Staging environment created',
      completed: progress.createWebStagingEnvironment,
    },
    {
      label: 'Web: GitHub linked',
      completed: progress.linkWebGitHub,
    },
    {
      label: 'Web: Branches configured',
      completed: progress.configureWebBranches,
    },
    {
      label: 'Web: Infisical sync → production',
      completed: progress.createWebInfisicalSyncProd,
    },
    {
      label: 'Web: Infisical sync → staging',
      completed: progress.createWebInfisicalSyncStaging,
    },
    {
      label: 'Web: Infisical sync → preview',
      completed: progress.createWebInfisicalSyncPreview,
    },
    // Admin app
    {
      label: adminProjectId ? `Admin: Project created (${adminProjectId})` : 'Admin: Project created',
      completed: progress.createAdminProject,
    },
    {
      label: 'Admin: Root directory configured',
      completed: progress.configureAdminRootDirectory,
    },
    {
      label: 'Admin: Staging environment created',
      completed: progress.createAdminStagingEnvironment,
    },
    {
      label: 'Admin: GitHub linked',
      completed: progress.linkAdminGitHub,
    },
    {
      label: 'Admin: Branches configured',
      completed: progress.configureAdminBranches,
    },
    {
      label: 'Admin: Infisical sync → production',
      completed: progress.createAdminInfisicalSyncProd,
    },
    {
      label: 'Admin: Infisical sync → staging',
      completed: progress.createAdminInfisicalSyncStaging,
    },
    {
      label: 'Admin: Infisical sync → preview',
      completed: progress.createAdminInfisicalSyncPreview,
    },
    // Superadmin app
    {
      label: superadminProjectId
        ? `Superadmin: Project created (${superadminProjectId})`
        : 'Superadmin: Project created',
      completed: progress.createSuperadminProject,
    },
    {
      label: 'Superadmin: Root directory configured',
      completed: progress.configureSuperadminRootDirectory,
    },
    {
      label: 'Superadmin: Staging environment created',
      completed: progress.createSuperadminStagingEnvironment,
    },
    {
      label: 'Superadmin: GitHub linked',
      completed: progress.linkSuperadminGitHub,
    },
    {
      label: 'Superadmin: Branches configured',
      completed: progress.configureSuperadminBranches,
    },
    {
      label: 'Superadmin: Infisical sync → production',
      completed: progress.createSuperadminInfisicalSyncProd,
    },
    {
      label: 'Superadmin: Infisical sync → staging',
      completed: progress.createSuperadminInfisicalSyncStaging,
    },
    {
      label: 'Superadmin: Infisical sync → preview',
      completed: progress.createSuperadminInfisicalSyncPreview,
    },
    // Final
    {
      label: 'Setup complete',
      completed: progress.deployProduction,
    },
  ];
};

export const VercelSetupView: React.FC<VercelSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('status');
  const [running, setRunning] = useState(false);
  const [teams, setTeams] = useState<Organization[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Derive setup state from config
  const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);

  // Progress items
  const progressItems = useMemo(() => (config ? getProgressDisplay(config) : []), [config]);

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
      } catch (err) {
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
  useInput((input, key) => {
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
      await updateConfigField('vercel', 'webProjectId', '');
      await updateConfigField('vercel', 'adminProjectId', '');
      await updateConfigField('vercel', 'superadminProjectId', '');
      await updateConfigField('vercel', 'configProjectName', '');
      await clearAllProgress('vercel');
      await clearConfigError('vercel');

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
      await clearConfigError('vercel');
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

    await clearConfigError('vercel');
    await syncConfig();

    const existingTeamId = config.vercel?.teamId;
    const existingTeamName = config.vercel?.teamName || '';
    if (existingTeamId) {
      setViewState('status');
      setRunning(true);
      await runSetup(existingTeamId, existingTeamName);
    }
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

            <Box marginTop={1}>
              <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
            </Box>
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
  const currentStepIndex = running ? progressItems.findIndex((item) => !item.completed) : -1;

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
        {progressItems.map((item, i) => {
          const isCompleted = item.completed;
          const isInProgress = running && i === currentStepIndex;
          const isPending = !isCompleted && !isInProgress;

          return (
            <Box key={i} marginLeft={2}>
              {isCompleted && <Text color="green">✓ {item.label}</Text>}
              {isInProgress && (
                <Text color="cyan">
                  <Spinner type="dots" /> {item.label}
                </Text>
              )}
              {isPending && <Text dimColor>− {item.label}</Text>}
            </Box>
          );
        })}
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
