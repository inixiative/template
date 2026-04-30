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
import { getRailwayProgressItems } from '../tasks/railwaySteps';
import { updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress, setError } from '../utils/progressTracking';
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
  const progressItems = useMemo(() => (config ? getRailwayProgressItems(config) : []), [config]);

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
      await clearProgress('railway');
      await clearError('railway');

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
      await clearError('railway');
      await syncConfig();

      // Read fresh config from disk (React state may be stale)
      const { getProjectConfig } = await import('../utils/getProjectConfig');
      const freshConfig = await getProjectConfig();
      let existingTeam = freshConfig.railway?.workspaceId;

      // If workspaceId was lost but workspace step is already complete,
      // auto-select if only one workspace, otherwise prompt
      if (!existingTeam || existingTeam.trim() === '') {
        if (workspaces.length === 1) {
          existingTeam = workspaces[0].id!;
          await updateConfigField('railway', 'workspaceId', existingTeam);
        }
      }

      if (existingTeam && existingTeam.trim() !== '') {
        // Resume with existing workspace
        await runSetup(existingTeam);
      } else {
        // No workspace selected and multiple options - ask user
        setRunning(false);
        setViewState('workspace-select');
      }
    }
  };

  const runSetup = async (workspaceId: string) => {
    // Read fresh config from disk (React state may be stale after syncConfig)
    const { getProjectConfig } = await import('../utils/getProjectConfig');
    const freshConfig = await getProjectConfig();

    // Check if workspace token exists in Infisical
    const infisicalProjectId = freshConfig.infisical.projectId;
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
      await clearError('railway');

      // Mark as complete to proceed past the check
      // If GitHub connection fails, the setup task will clear this flag
      // Fetch fresh config to avoid using stale progress from React state
      await syncConfig();
      const { getProjectConfig } = await import('../utils/getProjectConfig');
      const freshConfig = await getProjectConfig();
      const { markComplete: markStepComplete } = await import('../utils/progressTracking');
      await markStepComplete('railway', 'promptedForGithub');
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
      await setError('railway', actionError);
      await syncConfig();
    }
  };

  const handleWorkspaceSelect = async (workspaceId: string) => {
    // Persist workspaceId immediately so it survives restarts
    await updateConfigField('railway', 'workspaceId', workspaceId);
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
    if (viewState !== 'github-prompt' || confirmAction.running) return;

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
              <Text>To enable automatic deployments, do BOTH of these (in order):</Text>
            </Box>

            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              <Text bold>A. Connect GitHub to Railway (one-time per account)</Text>
              <Text>
                {'   '}1. Open <Text color="cyan">https://railway.com/account/integrations</Text>
              </Text>
              <Text>{'   '}2. Click "Connect" on the GitHub card</Text>
              <Text>{'   '}3. Authorize on the GitHub OAuth screen</Text>
            </Box>

            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              <Text bold>B. Install the Railway GitHub App on your repo's owner</Text>
              <Text>
                {'   '}1. Open <Text color="cyan">https://github.com/apps/railway-app/installations/new</Text>
              </Text>
              <Text>
                {'   '}2. Pick the account/org that owns the repo:{' '}
                <Text color="yellow">{config?.project.organization}</Text>
              </Text>
              <Text>{'   '} (NOT your personal account if the repo is in an org)</Text>
              <Text>{'   '}3. Choose "Only select repositories" → pick:</Text>
              <Text>
                {'   '}{' '}
                <Text color="yellow">
                  {config?.project.organization}/{config?.project.name}
                </Text>
              </Text>
              <Text>{'   '} (Or "All repositories" if you'll add more under this org)</Text>
              <Text>{'   '}4. Click "Install" at the bottom of the page</Text>
            </Box>

            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              <Text dimColor>Note: A only links your GitHub identity to Railway. B is what actually grants</Text>
              <Text dimColor>Railway permission to read the repo and deploy. Both are required.</Text>
              <Text dimColor>
                Already installed? Verify at https://github.com/organizations/{config?.project.organization}
                /settings/installations
              </Text>
            </Box>

            {confirmAction.error && (
              <Box marginTop={1}>
                <Text color="red">✗ {confirmAction.error}</Text>
              </Box>
            )}

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
      {!running && (
        <Box marginTop={1}>
          {setupState === 'new' && <Text color="cyan">⚡ Ready to provision Railway services</Text>}
          {setupState === 'stale' && <Text color="yellow">⚠ Project name changed - setup needs to be restarted</Text>}
          {setupState === 'incomplete' && <Text color="yellow">⋯ Setup in progress - continue where you left off</Text>}
          {setupState === 'complete' && <Text color="green">✓ Railway setup complete</Text>}
        </Box>
      )}

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
