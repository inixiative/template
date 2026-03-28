import { Box, Text } from 'ink';
import type React from 'react';
import { useCallback, useState } from 'react';
import { ConfigProvider } from './utils/configState';
import { EmailSetupView } from './views/EmailSetupView';
import { InfisicalSetupView } from './views/InfisicalSetupView';
import { LaunchView } from './views/LaunchView';
import { MainMenu } from './views/MainMenu';
import { PlanetScaleSetupView } from './views/PlanetScaleSetupView';
import { Prerequisites } from './views/Prerequisites';
import { ProjectConfigView } from './views/ProjectConfigView';
import { RailwaySetupView } from './views/RailwaySetupView';
import { VercelSetupView } from './views/VercelSetupView';

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
            {currentTask === 'resend' && <EmailSetupView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />}
            {currentTask === 'launch' && <LaunchView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />}
            {currentTask !== 'project-config' &&
              currentTask !== 'infisical' &&
              currentTask !== 'planetscale' &&
              currentTask !== 'railway' &&
              currentTask !== 'vercel' &&
              currentTask !== 'resend' &&
              currentTask !== 'launch' && (
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
