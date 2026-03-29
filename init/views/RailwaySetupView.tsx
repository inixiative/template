import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { railwayApi } from '../api/railway';
import { ActionSpinner } from '../components/ActionSpinner';
import { type Organization, OrgSelector } from '../components/OrgSelector';
import { StepProgress } from '../components/StepProgress';
import { useAsyncAction } from '../components/useAsyncAction';
import { getSecretAsync, setSecretAsync } from '../tasks/infisicalSetup';
import { setupRailway } from '../tasks/railwaySetup';
import { clearAllProgress, clearConfigError, setConfigError, updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'workspace-select' | 'token-input' | 'github-prompt';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type RailwaySetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
  // Railway config might not exist yet
  if (!config.railway) {
    return 'new';
  }

  const { progress, configProjectName } = config.railway;
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
  // Railway config might not exist yet
  if (!config.railway) {
    return [];
  }

  const {
    progress,
    workspaceId,
    projectId,
    prodEnvironmentId,
    stagingEnvironmentId,
    prodApiServiceId,
    stagingApiServiceId,
    prodWorkerServiceId,
    stagingWorkerServiceId,
    prodRedisServiceId,
    stagingRedisServiceId,
  } = config.railway;
  const prodEnvironmentCount = [
    progress.ensureProdEnvironment,
    progress.storeProdEnvironmentIdSecret,
    progress.deleteLegacyProductionEnvironment,
  ].filter(Boolean).length;
  const stagingEnvironmentCount = [progress.ensureStagingEnvironment, progress.storeStagingEnvironmentIdSecret].filter(
    Boolean,
  ).length;
  const prodRedisCount = [
    progress.ensureProdRedisService,
    progress.captureProdRedisVolume,
    progress.renameProdRedisService,
    progress.renameProdRedisVolume,
    progress.storeProdRedisUrl,
  ].filter(Boolean).length;
  const stagingRedisCount = [
    progress.ensureStagingRedisService,
    progress.captureStagingRedisVolume,
    progress.renameStagingRedisService,
    progress.renameStagingRedisVolume,
    progress.storeStagingRedisUrl,
  ].filter(Boolean).length;
  const prodApiCount = [
    progress.ensureProdApiService,
    progress.storeProdApiServiceIdSecret,
    progress.createInfisicalSyncProd,
    progress.configureProdApiService,
    progress.connectProdApiGithub,
    progress.ensureProdApiDeployment,
    progress.storeProdApiUrl,
  ].filter(Boolean).length;
  const stagingApiCount = [
    progress.ensureStagingApiService,
    progress.storeStagingApiServiceIdSecret,
    progress.createInfisicalSyncStagingApi,
    progress.configureStagingApiService,
    progress.connectStagingApiGithub,
    progress.ensureStagingApiDeployment,
    progress.storeStagingApiUrl,
  ].filter(Boolean).length;
  const prodWorkerCount = [
    progress.ensureProdWorkerService,
    progress.storeProdWorkerServiceIdSecret,
    progress.createInfisicalSyncProdWorker,
    progress.configureProdWorkerService,
    progress.connectProdWorkerGithub,
    progress.ensureProdWorkerDeployment,
  ].filter(Boolean).length;
  const stagingWorkerCount = [
    progress.ensureStagingWorkerService,
    progress.storeStagingWorkerServiceIdSecret,
    progress.createInfisicalSyncStagingWorker,
    progress.configureStagingWorkerService,
    progress.connectStagingWorkerGithub,
    progress.ensureStagingWorkerDeployment,
  ].filter(Boolean).length;

  return [
    {
      label: workspaceId ? `Workspace selected: ${workspaceId}` : 'Workspace selected',
      completed: progress.selectWorkspace,
    },
    {
      label: 'Railway token stored in Infisical',
      completed: progress.storeRailwayToken,
    },
    {
      label: projectId ? `Project created: ${projectId}` : 'Project created',
      completed: progress.createProject,
    },
    {
      label: prodEnvironmentId
        ? `Production environment ready (${prodEnvironmentCount}/3): ${prodEnvironmentId}`
        : `Production environment ready (${prodEnvironmentCount}/3)`,
      completed: prodEnvironmentCount === 3,
    },
    {
      label: stagingEnvironmentId
        ? `Staging environment ready (${stagingEnvironmentCount}/2): ${stagingEnvironmentId}`
        : `Staging environment ready (${stagingEnvironmentCount}/2)`,
      completed: stagingEnvironmentCount === 2,
    },
    {
      label: prodRedisServiceId
        ? `Prod Redis ready (${prodRedisCount}/5): ${prodRedisServiceId}`
        : `Prod Redis ready (${prodRedisCount}/5)`,
      completed: prodRedisCount === 5,
    },
    {
      label: stagingRedisServiceId
        ? `Staging Redis ready (${stagingRedisCount}/5): ${stagingRedisServiceId}`
        : `Staging Redis ready (${stagingRedisCount}/5)`,
      completed: stagingRedisCount === 5,
    },
    {
      label: 'Infisical Railway connection created',
      completed: progress.createInfisicalConnection,
    },
    {
      label: 'GitHub setup confirmed',
      completed: progress.promptedForGithub,
    },
    {
      label: prodApiServiceId
        ? `Prod API ready (${prodApiCount}/7): ${prodApiServiceId}`
        : `Prod API ready (${prodApiCount}/7)`,
      completed: prodApiCount === 7,
    },
    {
      label: stagingApiServiceId
        ? `Staging API ready (${stagingApiCount}/7): ${stagingApiServiceId}`
        : `Staging API ready (${stagingApiCount}/7)`,
      completed: stagingApiCount === 7,
    },
    {
      label: prodWorkerServiceId
        ? `Prod Worker ready (${prodWorkerCount}/6): ${prodWorkerServiceId}`
        : `Prod Worker ready (${prodWorkerCount}/6)`,
      completed: prodWorkerCount === 6,
    },
    {
      label: stagingWorkerServiceId
        ? `Staging Worker ready (${stagingWorkerCount}/6): ${stagingWorkerServiceId}`
        : `Staging Worker ready (${stagingWorkerCount}/6)`,
      completed: stagingWorkerCount === 6,
    },
  ];
};

export const RailwaySetupView: React.FC<RailwaySetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('status');
  const [running, setRunning] = useState(false);
  const [workspaces, setWorkspaces] = useState<Organization[] | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaceToken, setWorkspaceToken] = useState('');
  const tokenAction = useAsyncAction();
  const confirmAction = useAsyncAction();

  // Derive setup state from config
  const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);

  // Progress items
  const progressItems = useMemo(() => (config ? getProgressDisplay(config) : []), [config]);

  // Load workspaces on mount
  useEffect(() => {
    const init = async () => {
      try {
        const railwayWorkspaces = await railwayApi.listWorkspaces();
        // Convert Railway workspaces to Organization format for OrgSelector
        setWorkspaces(
          railwayWorkspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
          })),
        );
      } catch (_err) {
        setWorkspaces([]);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    init();
  }, []);

  // Handle keyboard input on status page
  useInput((input, key) => {
    // Prevent input if already running or processing
    if (viewState !== 'status' || running || tokenAction.running) return;

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

  const handleAction = async (action: 'run' | 'continue' | 'restart') => {
    // Prevent duplicate calls
    if (!config || !workspaces || running || tokenAction.running) return;

    // Show loading immediately
    setRunning(true);

    if (action === 'restart') {
      // Clear progress, config, and errors
      await updateConfigField('railway', 'workspaceId', '');
      await updateConfigField('railway', 'projectId', '');
      await updateConfigField('railway', 'prodEnvironmentId', '');
      await updateConfigField('railway', 'stagingEnvironmentId', '');
      await updateConfigField('railway', 'prodApiServiceId', '');
      await updateConfigField('railway', 'stagingApiServiceId', '');
      await updateConfigField('railway', 'prodWorkerServiceId', '');
      await updateConfigField('railway', 'stagingWorkerServiceId', '');
      await updateConfigField('railway', 'prodRedisServiceId', '');
      await updateConfigField('railway', 'stagingRedisServiceId', '');
      await updateConfigField('railway', 'prodRedisVolumeId', '');
      await updateConfigField('railway', 'stagingRedisVolumeId', '');
      await updateConfigField('railway', 'configProjectName', '');
      await clearAllProgress('railway');
      await clearConfigError('railway');

      // Refresh config
      await syncConfig();

      // Go to workspace select (or run immediately if 1 workspace)
      if (workspaces.length === 1) {
        await runSetup(workspaces[0].id!);
      } else {
        setRunning(false);
        setViewState('workspace-select');
      }
      return;
    }

    if (action === 'continue' || action === 'run') {
      // Clear any previous errors
      await clearConfigError('railway');
      await syncConfig();

      // Try to use existing workspace from config first
      const existingTeam = config.railway?.workspaceId;

      if (existingTeam && existingTeam.trim() !== '') {
        // Resume with existing workspace
        await runSetup(existingTeam);
      } else {
        // No workspace selected - go to workspace selection
        if (workspaces.length === 1) {
          await runSetup(workspaces[0].id!);
        } else {
          setRunning(false);
          setViewState('workspace-select');
        }
      }
    }
  };

  const runSetup = async (workspaceId: string) => {
    if (!config) return;

    // Check if workspace token exists in Infisical
    const infisicalProjectId = config.infisical.projectId;
    let hasToken = false;

    try {
      const token = await getSecretAsync('RAILWAY_WORKSPACE_TOKEN', {
        projectId: infisicalProjectId,
        environment: 'root',
      });
      hasToken = !!token;
    } catch (_error) {
      // Token doesn't exist
      hasToken = false;
    }

    // If no token, prompt for it
    if (!hasToken) {
      setRunning(false);
      setViewState('token-input');
      return;
    }

    // Token exists, proceed with setup (running already set to true in handleAction)
    setViewState('status');

    try {
      await setupRailway(workspaceId, syncConfig);
      await syncConfig();
      setRunning(false);
    } catch (error) {
      // Check if this is the GitHub setup required error
      if (error instanceof Error && error.message === 'GITHUB_SETUP_REQUIRED') {
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

  const handleGithubConfirm = async () => {
    if (!config) return;

    await confirmAction.run('Resuming setup...', async () => {
      await clearConfigError('railway');

      // Mark as complete to proceed past the check
      // If GitHub connection fails, the setup task will clear this flag
      // Fetch fresh config to avoid using stale progress from React state
      await syncConfig();
      const { getProjectConfig } = await import('../utils/getProjectConfig');
      const freshConfig = await getProjectConfig();
      const { setProgressComplete } = await import('../utils/configHelpers');
      await setProgressComplete('railway', 'promptedForGithub');
      await syncConfig();

      const existingWorkspace = freshConfig.railway?.workspaceId;
      if (existingWorkspace) {
        setViewState('status');
        setRunning(true);
        await runSetup(existingWorkspace);
      }
    });
  };

  const handleTokenSubmit = async () => {
    if (!config || !workspaceToken.trim()) return;

    const actionError = await tokenAction.run('Storing token and continuing setup...', async () => {
      // Store token in Infisical
      const infisicalProjectId = config.infisical.projectId;
      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_WORKSPACE_TOKEN', workspaceToken.trim());

      // Continue with setup
      const existingWorkspace = config.railway?.workspaceId;
      if (existingWorkspace && existingWorkspace.trim() !== '') {
        setRunning(true);
        setViewState('status');
        await runSetup(existingWorkspace);
      } else if (workspaces && workspaces.length === 1) {
        setRunning(true);
        setViewState('status');
        await runSetup(workspaces[0].id!);
      } else {
        setRunning(false);
        setViewState('workspace-select');
      }
    });

    if (actionError) {
      setRunning(false);
      setViewState('status');
      await setConfigError('railway', actionError);
      await syncConfig();
    }
  };

  const handleWorkspaceSelect = async (workspaceId: string) => {
    // Show spinner immediately when workspace is selected
    setRunning(true);
    await runSetup(workspaceId);
  };

  // Handle escape in token input
  useInput((_input, key) => {
    if (viewState === 'token-input' && key.escape) {
      onCancel();
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

  // Token input view
  if (viewState === 'token-input') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Railway Workspace Token Required</Text>

        <Box marginTop={1}>
          <Text>
            Create a workspace token at: <Text color="cyan">https://railway.com/account/tokens</Text>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text>Paste the token below (UUID format, ~36 characters):</Text>
        </Box>

        {tokenAction.running ? (
          <ActionSpinner label={tokenAction.actionLabel} />
        ) : (
          <>
            <Box marginTop={1}>
              <Text>Token: </Text>
              <TextInput value={workspaceToken} onChange={setWorkspaceToken} onSubmit={handleTokenSubmit} mask="*" />
            </Box>

            <Box marginTop={1}>
              <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
            </Box>
          </>
        )}
      </Box>
    );
  }

  // Workspace selection view
  if (viewState === 'workspace-select') {
    return (
      <OrgSelector
        organizations={workspaces || []}
        serviceName="Railway"
        loading={running}
        onSelect={handleWorkspaceSelect}
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
              GitHub Setup Required
            </Text>

            <Box marginTop={1}>
              <Text>Railway services are ready to be deployed.</Text>
            </Box>

            <Box marginTop={1}>
              <Text>To enable automatic deployments, complete these steps:</Text>
            </Box>

            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              <Text>
                1. Go to Railway dashboard: <Text color="cyan">https://railway.app/account</Text>
              </Text>
              <Text>2. Connect your GitHub account (Settings → Connected Accounts)</Text>
              <Text>3. Install Railway GitHub App on your repository</Text>
              <Text>
                4. Grant access to:{' '}
                <Text color="yellow">
                  {config?.project.organization}/{config?.project.name}
                </Text>
              </Text>
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
  if (!config || loadingWorkspaces) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  // Status view (main screen)
  const error = config.railway?.error;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Railway Setup</Text>

      {/* Error Display */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ Error: {error}</Text>
        </Box>
      )}

      {/* Setup state indicator */}
      <Box marginTop={1}>
        {setupState === 'new' && <Text color="cyan">⚡ Ready to provision Railway services</Text>}
        {setupState === 'stale' && <Text color="yellow">⚠ Project name changed - setup needs to be restarted</Text>}
        {setupState === 'incomplete' && <Text color="yellow">⋯ Setup in progress - continue where you left off</Text>}
        {setupState === 'complete' && <Text color="green">✓ Railway setup complete</Text>}
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
          {setupState === 'incomplete' && <Text dimColor>{prompt(['enter', 'cancel'])}</Text>}
          {setupState === 'complete' && <Text dimColor>{prompt(['enter', 'restart'])}</Text>}
        </Box>
      )}
    </Box>
  );
};
