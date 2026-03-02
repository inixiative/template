import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { useConfig } from '../utils/configState';
import { setupInfisical } from '../tasks/infisicalSetup';
import { listOrganizations } from '../api/infisical';
import { OrgSelector, type Organization } from '../components/OrgSelector';
import { updateConfigField, clearAllProgress, clearConfigError } from '../utils/configHelpers';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'org-select';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type InfisicalSetupViewProps = {
	onComplete: () => void;
	onCancel: () => void;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
	const { progress, configProjectName, projectId } = config.infisical;
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
	const { progress, organizationSlug, projectSlug } = config.infisical;
	return [
		{
			label: organizationSlug ? `Organization selected: ${organizationSlug}` : 'Organization selected',
			completed: progress.selectOrg
		},
		{
			label: projectSlug ? `Project created: ${projectSlug}` : 'Project created',
			completed: progress.createProject
		},
		{
			label: 'Environments configured',
			completed: progress.renameEnv
		},
		{
			label: 'Folder structure created',
			completed: progress.createApps
		},
		{
			label: 'Inheritance chains configured',
			completed: progress.setInheritance
		},
	];
};

export const InfisicalSetupView: React.FC<InfisicalSetupViewProps> = ({ onComplete, onCancel }) => {
	const { config, syncConfig } = useConfig();
	const [viewState, setViewState] = useState<ViewState>('status');
	const [running, setRunning] = useState(false);
	const [organizations, setOrganizations] = useState<Organization[]>([]);

	// Derive setup state from config (no delay)
	const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);

	// Load organizations
	useEffect(() => {
		const init = async () => {
			const orgs = await listOrganizations();
			setOrganizations(orgs);
		};

		init();
	}, []);

	// Handle keyboard input on status page
	useInput((input, key) => {
		if (viewState !== 'status' || running) return;

		if (key.escape) {
			onCancel();
		} else if (key.return) {
			// Enter: Run setup or Continue
			handleAction(setupState === 'incomplete' ? 'continue' : 'run');
		} else if (input.toLowerCase() === 'r') {
			// R: Restart
			handleAction('restart');
		}
	});

	const handleAction = async (action: 'run' | 'continue' | 'restart') => {
		if (!config) return;

		if (action === 'restart') {
			// Clear progress and config, go to org select
			await updateConfigField('infisical', 'projectId', '');
			await updateConfigField('infisical', 'organizationId', '');
			await updateConfigField('infisical', 'organizationSlug', '');
			await updateConfigField('infisical', 'projectSlug', '');
			await updateConfigField('infisical', 'configProjectName', '');
			await clearAllProgress('infisical');
			await clearConfigError('infisical');

			// Refresh config (setupState will auto-update via useMemo)
			await syncConfig();

			// Go to org select (or run immediately if 1 org)
			if (organizations.length === 1) {
				await runSetup(organizations[0].id);
			} else {
				setViewState('org-select');
			}
			return;
		}

		if (action === 'run' || action === 'continue') {
			// Clear any previous errors
			await clearConfigError('infisical');
			await syncConfig();

			// Check if need org selection
			if (organizations.length === 1) {
				// Single org - run immediately
				await runSetup(organizations[0].id);
			} else {
				// Multiple orgs - show selector
				setViewState('org-select');
			}
		}
	};

	const handleOrgSelect = async (orgId: string) => {
		if (!config) return;

		// Clear if org changed
		const currentOrg = config.infisical.organizationId;
		if (currentOrg && currentOrg !== orgId) {
			console.log('Organization changed - clearing Infisical config');
			await updateConfigField('infisical', 'projectId', '');
			await updateConfigField('infisical', 'organizationId', '');
			await updateConfigField('infisical', 'organizationSlug', '');
			await updateConfigField('infisical', 'projectSlug', '');
			await updateConfigField('infisical', 'configProjectName', '');
			await clearAllProgress('infisical');
			await clearConfigError('infisical');
		}

		// Return to status and run setup
		setViewState('status');
		await runSetup(orgId);
	};

	const runSetup = async (orgId: string) => {
		setRunning(true);
		try {
			await setupInfisical(orgId, syncConfig); // Pass syncConfig for live updates

			// Refresh config to show completed progress (setupState will auto-update via useMemo)
			await syncConfig();
			setRunning(false);

			// Auto-return to main menu
			setTimeout(() => onComplete(), 2000);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Setup failed';
			console.error('Setup error:', errorMsg);

			// Error is already persisted by setupInfisical, just refresh
			await syncConfig();
			setRunning(false);
		}
	};

	// Org selector view
	if (viewState === 'org-select') {
		return (
			<OrgSelector
				organizations={organizations}
				serviceName="Infisical"
				onSelect={handleOrgSelect}
				onCancel={onCancel}
			/>
		);
	}

	// Status page view
	if (!config) {
		return (
			<Box padding={1}>
				<Text>Loading configuration...</Text>
			</Box>
		);
	}

	const progressItems = getProgressDisplay(config);
	const error = config.infisical.error;

	// Determine which step is currently in progress
	const currentStepIndex = running ? progressItems.findIndex((item) => !item.completed) : -1;

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Infisical Setup</Text>

			{/* Progress List - Show ALL steps */}
			<Box flexDirection="column" marginTop={1}>
				{progressItems.map((item, i) => {
					const isCompleted = item.completed;
					const isInProgress = running && i === currentStepIndex;
					const isPending = !isCompleted && !isInProgress;

					return (
						<Box key={i}>
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

			{/* Error Display */}
			{error && (
				<Box marginTop={1}>
					<Text color="red">✗ Error: {error}</Text>
				</Box>
			)}

			{/* State Message */}
			{setupState === 'stale' && (
				<Box marginTop={1}>
					<Text color="yellow">⚠ Project name changed - config needs update</Text>
				</Box>
			)}

			{config && setupState === 'new' && !running && (
				<Box marginTop={1}>
					<Text dimColor>No Infisical project configured</Text>
				</Box>
			)}

			{/* Actions */}
			{!running && (
				<Box marginTop={1}>
					<Text dimColor>
						{setupState === 'new' || setupState === 'stale'
							? prompt(['enter', 'cancel'])
							: setupState === 'incomplete'
								? prompt(['enter', 'restart', 'cancel'])
								: `Setup complete! ${prompt(['restart', 'cancel'])}`}
					</Text>
				</Box>
			)}
		</Box>
	);
};
