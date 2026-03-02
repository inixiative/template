import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';
import { listWorkspaces } from '../api/railway';
import { OrgSelector, type Organization } from '../components/OrgSelector';
import { updateConfigField, clearAllProgress, clearConfigError } from '../utils/configHelpers';
import { setupRailway } from '../tasks/railwaySetup';
import { setSecret, getSecret } from '../tasks/infisicalSetup';

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

	const { progress, workspaceId, projectId, prodApiServiceId, stagingApiServiceId, prodWorkerServiceId, stagingWorkerServiceId, prodRedisServiceId, stagingRedisServiceId } = config.railway;
	return [
		{
			label: workspaceId ? `Workspace selected: ${workspaceId}` : 'Workspace selected',
			completed: progress.selectWorkspace
		},
		{
			label: 'Railway token stored in Infisical',
			completed: progress.storeRailwayToken
		},
		{
			label: projectId ? `Project created: ${projectId}` : 'Project created',
			completed: progress.createProject
		},
		{
			label: 'Created "prod" and deleted "production" environment',
			completed: progress.renameProductionEnv
		},
		{
			label: 'Created "staging" environment',
			completed: progress.createStagingEnv
		},
		{
			label: prodRedisServiceId ? `Prod Redis created: ${prodRedisServiceId}` : 'Prod Redis created',
			completed: progress.createRedisProd
		},
		{
			label: 'Prod Redis service renamed to "redis-prod"',
			completed: progress.renameRedisProd
		},
		{
			label: 'Prod Redis volume renamed to "redis-prod-data"',
			completed: progress.renameRedisProdVolume
		},
		{
			label: stagingRedisServiceId ? `Staging Redis created: ${stagingRedisServiceId}` : 'Staging Redis created',
			completed: progress.createRedisStaging
		},
		{
			label: 'Staging Redis service renamed to "redis-staging"',
			completed: progress.renameRedisStaging
		},
		{
			label: 'Staging Redis volume renamed to "redis-staging-data"',
			completed: progress.renameRedisStagingVolume
		},
		{
			label: 'Redis URLs stored in Infisical',
			completed: progress.storeRedisUrl
		},
		{
			label: 'Infisical Railway connection created',
			completed: progress.createInfisicalConnection
		},
		{
			label: 'GitHub setup confirmed',
			completed: progress.promptedForGithub
		},
		{
			label: prodApiServiceId ? `Prod API service created: ${prodApiServiceId}` : 'Prod API service created',
			completed: progress.createApiProd
		},
		{
			label: 'Infisical sync created for prod API',
			completed: progress.createInfisicalSyncProd
		},
		{
			label: 'Prod API connected to GitHub and deployed',
			completed: progress.connectApiProdGithub
		},
		{
			label: stagingApiServiceId ? `Staging API service created: ${stagingApiServiceId}` : 'Staging API service created',
			completed: progress.createApiStaging
		},
		{
			label: 'Infisical sync created for staging API',
			completed: progress.createInfisicalSyncStagingApi
		},
		{
			label: 'Staging API connected to GitHub and deployed',
			completed: progress.connectApiStagingGithub
		},
		{
			label: 'API URLs stored in Infisical',
			completed: progress.storeApiUrl
		},
		{
			label: prodWorkerServiceId ? `Prod Worker service created: ${prodWorkerServiceId}` : 'Prod Worker service created',
			completed: progress.createWorkerProd
		},
		{
			label: 'Prod Worker connected to GitHub and deployed',
			completed: progress.connectWorkerProdGithub
		},
		{
			label: stagingWorkerServiceId ? `Staging Worker service created: ${stagingWorkerServiceId}` : 'Staging Worker service created',
			completed: progress.createWorkerStaging
		},
		{
			label: 'Infisical sync created for staging Worker',
			completed: progress.createInfisicalSyncStagingWorker
		},
		{
			label: 'Staging Worker connected to GitHub and deployed',
			completed: progress.connectWorkerStagingGithub
		},
		{
			label: 'All deployments verified',
			completed: progress.verifyDeployment
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
	const [storingToken, setStoringToken] = useState(false);

	// Derive setup state from config
	const setupState = useMemo(
		() => config ? detectSetupState(config) : 'new',
		[config]
	);

	// Progress items
	const progressItems = useMemo(
		() => config ? getProgressDisplay(config) : [],
		[config]
	);

	// Load workspaces on mount
	useEffect(() => {
		const init = async () => {
			try {
				const railwayWorkspaces = await listWorkspaces();
				// Convert Railway workspaces to Organization format for OrgSelector
				setWorkspaces(railwayWorkspaces.map(workspace => ({
					id: workspace.id,
					name: workspace.name,
				})));
			} catch (err) {
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
		if (viewState !== 'status' || running || storingToken) return;

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
		if (!config || !workspaces || running || storingToken) return;

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
				await runSetup(workspaces[0].id);
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
					await runSetup(workspaces[0].id);
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
			const token = getSecret('RAILWAY_WORKSPACE_TOKEN', {
				projectId: infisicalProjectId,
				environment: 'root',
			});
			hasToken = !!token;
		} catch (error) {
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

		await clearConfigError('railway');

		// Mark as complete to proceed past the check
		// If GitHub connection fails, the setup task will clear this flag
		// Fetch fresh config to avoid using stale progress from React state
		await syncConfig();
		const { getProjectConfig } = await import('../utils/getProjectConfig');
		const freshConfig = await getProjectConfig();
		await updateConfigField('railway', 'progress', {
			...freshConfig.railway.progress,
			promptedForGithub: true
		});
		await syncConfig();

		const existingWorkspace = freshConfig.railway?.workspaceId;
		if (existingWorkspace) {
			setViewState('status');
			setRunning(true);
			await runSetup(existingWorkspace);
		}
	};

	const handleTokenSubmit = async () => {
		if (!config || !workspaceToken.trim()) return;

		setStoringToken(true);

		try {
			// Store token in Infisical
			const infisicalProjectId = config.infisical.projectId;
			await setSecret(infisicalProjectId, 'root', 'RAILWAY_WORKSPACE_TOKEN', workspaceToken.trim());

			setStoringToken(false);

			// Continue with setup
			const existingWorkspace = config.railway?.workspaceId;
			if (existingWorkspace && existingWorkspace.trim() !== '') {
				setRunning(true);
				setViewState('status');
				await runSetup(existingWorkspace);
			} else if (workspaces && workspaces.length === 1) {
				setRunning(true);
				setViewState('status');
				await runSetup(workspaces[0].id);
			} else {
				setRunning(false);
				setViewState('workspace-select');
			}
		} catch (error) {
			setStoringToken(false);
			setRunning(false);
			throw error;
		}
	};

	const handleWorkspaceSelect = async (workspaceId: string) => {
		// Show spinner immediately when workspace is selected
		setRunning(true);
		await runSetup(workspaceId);
	};

	// Handle escape in token input
	useInput((input, key) => {
		if (viewState === 'token-input' && key.escape) {
			onCancel();
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

	// Token input view
	if (viewState === 'token-input') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Railway Workspace Token Required</Text>

				<Box marginTop={1}>
					<Text>Create a workspace token at: <Text color="cyan">https://railway.com/account/tokens</Text></Text>
				</Box>

				<Box marginTop={1}>
					<Text>Paste the token below (UUID format, ~36 characters):</Text>
				</Box>

				{storingToken ? (
					<Box marginTop={1}>
						<Text color="cyan">
							<Spinner type="dots" /> Storing token and continuing setup...
						</Text>
					</Box>
				) : (
					<>
						<Box marginTop={1}>
							<Text>Token: </Text>
							<TextInput
								value={workspaceToken}
								onChange={setWorkspaceToken}
								onSubmit={handleTokenSubmit}
								mask="*"
							/>
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
						<Text bold color="cyan">GitHub Setup Required</Text>

						<Box marginTop={1}>
							<Text>Railway services are ready to be deployed.</Text>
						</Box>

						<Box marginTop={1}>
							<Text>To enable automatic deployments, complete these steps:</Text>
						</Box>

						<Box flexDirection="column" marginTop={1} marginLeft={2}>
							<Text>1. Go to Railway dashboard: <Text color="cyan">https://railway.app/account</Text></Text>
							<Text>2. Connect your GitHub account (Settings → Connected Accounts)</Text>
							<Text>3. Install Railway GitHub App on your repository</Text>
							<Text>4. Grant access to: <Text color="yellow">{config?.project.organization}/{config?.project.name}</Text></Text>
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
	if (!config || loadingWorkspaces) {
		return (
			<Box padding={1}>
				<Text>Loading...</Text>
			</Box>
		);
	}

	// Status view (main screen)
	const error = config.railway?.error;
	const currentStepIndex = running ? progressItems.findIndex((item) => !item.completed) : -1;

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
				{setupState === 'new' && (
					<Text color="cyan">⚡ Ready to provision Railway services</Text>
				)}
				{setupState === 'stale' && (
					<Text color="yellow">⚠ Project name changed - setup needs to be restarted</Text>
				)}
				{setupState === 'incomplete' && (
					<Text color="yellow">⋯ Setup in progress - continue where you left off</Text>
				)}
				{setupState === 'complete' && (
					<Text color="green">✓ Railway setup complete</Text>
				)}
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
					{setupState === 'new' && (
						<Text dimColor>{prompt(['enter', 'cancel'])}</Text>
					)}
					{setupState === 'stale' && (
						<Text dimColor>{prompt(['restart', 'cancel'])}</Text>
					)}
					{setupState === 'incomplete' && (
						<Text dimColor>{prompt(['enter', 'cancel'])}</Text>
					)}
					{setupState === 'complete' && (
						<Text dimColor>{prompt(['enter', 'restart'])}</Text>
					)}
				</Box>
			)}
		</Box>
	);
};
