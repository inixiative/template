import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Prerequisites } from './views/Prerequisites';
import { MainMenu } from './views/MainMenu';
import { ProjectConfigView } from './views/ProjectConfigView';
import { InfisicalSetupView } from './views/InfisicalSetupView';
import { PlanetScaleSetupView } from './views/PlanetScaleSetupView';
import { RailwaySetupView } from './views/RailwaySetupView';
import { VercelSetupView } from './views/VercelSetupView';
import { ConfigProvider } from './utils/configState';

type AppState = 'prerequisites' | 'menu' | 'task';

export const App: React.FC = () => {
	const [state, setState] = useState<AppState>('prerequisites');
	const [currentTask, setCurrentTask] = useState<string | null>(null);

	const handlePrerequisitesComplete = useCallback(() => {
		setState('menu');
	}, []);

	const handleSelectTask = (taskId: string) => {
		if (taskId === 'exit') {
			process.exit(0);
		}
		setCurrentTask(taskId);
		setState('task');
	};

	const handleTaskComplete = () => {
		setState('menu');
		setCurrentTask(null);
	};

	const handleTaskCancel = () => {
		setState('menu');
		setCurrentTask(null);
	};

	return (
		<ConfigProvider>
			<Box flexDirection="column">
				<Box>
					<Text bold color="cyan">
						🚀 Template Initialization
					</Text>
				</Box>

				{state === 'prerequisites' && <Prerequisites onComplete={handlePrerequisitesComplete} />}

				{state === 'menu' && <MainMenu key={Date.now()} onSelectTask={handleSelectTask} />}

				{state === 'task' && (
					<>
						{currentTask === 'project-config' && (
							<ProjectConfigView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />
						)}
						{currentTask === 'infisical' && (
							<InfisicalSetupView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />
						)}
						{currentTask === 'planetscale' && (
							<PlanetScaleSetupView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />
						)}
						{currentTask === 'railway' && (
							<RailwaySetupView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />
						)}
						{currentTask === 'vercel' && (
							<VercelSetupView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />
						)}
						{currentTask !== 'project-config' &&
							currentTask !== 'infisical' &&
							currentTask !== 'planetscale' &&
							currentTask !== 'railway' &&
							currentTask !== 'vercel' && (
								<Box flexDirection="column">
									<Text color="yellow">Task: {currentTask}</Text>
									<Text dimColor>Coming soon...</Text>
								</Box>
							)}
					</>
				)}
			</Box>
		</ConfigProvider>
	);
};
