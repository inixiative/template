import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { execSync } from 'node:child_process';
import { getCurrentConfig, updateProjectConfig, renameProject } from '../tasks/projectConfig';
import { prompt } from '../utils/prompts';
import { setProgressComplete } from '../utils/configHelpers';

type ViewState = 'loading' | 'prompt-name' | 'prompt-org' | 'confirm' | 'executing' | 'running-setup' | 'complete';

type ProjectConfigViewProps = {
	onComplete: () => void;
	onCancel: () => void;
};

export const ProjectConfigView: React.FC<ProjectConfigViewProps> = ({ onComplete, onCancel }) => {
	const [state, setState] = useState<ViewState>('loading');
	const [currentConfig, setCurrentConfig] = useState({ name: '', organization: '' });
	const [newName, setNewName] = useState('');
	const [newOrg, setNewOrg] = useState('');
	const [error, setError] = useState<string | null>(null);

	// Handle escape key to cancel
	useInput((input, key) => {
		if (key.escape && state !== 'executing' && state !== 'complete') {
			onCancel();
		}
	});

	useEffect(() => {
		const loadConfig = async () => {
			try {
				const config = await getCurrentConfig();
				setCurrentConfig(config);
				setNewName(config.name);
				setNewOrg(config.organization);
				setState('prompt-name');
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load config');
			}
		};

		// Defer to avoid blocking React
		setTimeout(() => loadConfig(), 100);
	}, []);

	const handleNameSubmit = (value: string) => {
		setNewName(value || currentConfig.name);
		setState('prompt-org');
	};

	const handleOrgSubmit = (value: string) => {
		setNewOrg(value || currentConfig.organization);
		setState('confirm');
	};

	const handleConfirm = () => {
		setState('executing');

		setTimeout(async () => {
			try {
				updateProjectConfig({ name: newName, organization: newOrg });

				if (newOrg && newOrg.trim() !== '') {
					await setProgressComplete('project', 'renameOrg');
				}

				if (newName !== currentConfig.name) {
					renameProject(currentConfig.name, newName);
				}

				if (newName && newName.trim() !== '') {
					await setProgressComplete('project', 'renameProject');
				}

				setState('running-setup');
				execSync('bun run setup', { stdio: 'pipe' });
				await setProgressComplete('project', 'setup');

				setState('complete');
				setTimeout(() => onComplete(), 2000);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to update config');
			}
		}, 100);
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

	if (state === 'loading') {
		return (
			<Box padding={1}>
				<Text>Loading current configuration...</Text>
			</Box>
		);
	}

	if (state === 'prompt-name') {
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold>Project Configuration</Text>
				</Box>

				<Box flexDirection="column" marginBottom={1}>
					<Text dimColor>Current Configuration:</Text>
					<Text>  Name: {currentConfig.name}</Text>
					<Text>  Organization: {currentConfig.organization}</Text>
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

	if (state === 'prompt-org') {
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold>Project Configuration</Text>
				</Box>

				<Box flexDirection="column" marginBottom={1}>
					<Text dimColor>Current Configuration:</Text>
					<Text>  Name: {newName}</Text>
					<Text>  Organization: {currentConfig.organization}</Text>
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

	if (state === 'confirm') {
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

	if (state === 'executing') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text>
					<Spinner type="dots" /> Updating configuration...
				</Text>
			</Box>
		);
	}

	if (state === 'running-setup') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green">✓ Configuration updated</Text>
				<Text>
					<Spinner type="dots" /> Running bun run setup (starting Docker)...
				</Text>
			</Box>
		);
	}

	if (state === 'complete') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green">✓ Configuration complete!</Text>
				<Text color="green">✓ Docker started with new project names</Text>
			</Box>
		);
	}

	return null;
};
