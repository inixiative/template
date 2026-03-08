import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { prompt } from '../utils/prompts';

type MenuItem = {
  label: string;
  value: string;
  status: 'pending' | 'incomplete' | 'completed';
  progressDetails?: string[];
};

type MainMenuProps = {
  onSelectTask: (taskId: string) => void;
};

const getProjectConfigStatus = (config: ProjectConfig): MenuItem['status'] => {
  // Check if all project config steps are complete
  const { progress } = config.project;
  const allComplete = progress.renameOrg && progress.renameProject && progress.setup;
  return allComplete ? 'completed' : 'pending';
};

const getInfisicalStatus = (config: ProjectConfig): { status: MenuItem['status']; details: string[] } => {
  const { progress, error } = config.infisical;
  const completed = Object.values(progress).filter((v) => v === true).length;
  const total = Object.keys(progress).length;

  const details: string[] = [];
  if (progress.selectOrg) details.push('Organization selected');
  if (progress.createProject) details.push('Project created');
  if (progress.renameEnv) details.push('Environments configured');
  if (progress.createApps) details.push('Folder structure created');
  if (progress.setInheritance) details.push('Inheritance chains configured');
  if (progress.ensureApiAuthSecrets) details.push('API auth secrets initialized');

  if (error) {
    details.push(`Error: ${error}`);
  }

  if (completed === 0) return { status: 'pending', details: [] };
  if (completed < total) return { status: 'incomplete', details };
  return { status: 'completed', details };
};

const getPlanetScaleStatus = (config: ProjectConfig): { status: MenuItem['status']; details: string[] } => {
  const { progress, error } = config.planetscale;
  const completed = Object.values(progress).filter((v) => v === true).length;
  const total = Object.keys(progress).length;

  const details: string[] = [];
  if (progress.selectOrg) details.push('Organization selected');
  if (progress.selectRegion) details.push('Region selected');
  if (progress.createToken) details.push('Service token created');
  if (progress.setInfisicalToken) details.push('Token stored in Infisical');
  if (progress.createDB) details.push('Database created');
  if (progress.renameProductionBranch) details.push('Production branch renamed');
  if (progress.createStagingBranch) details.push('Staging branch created');
  if (progress.createPasswords) details.push('Roles created');
  if (progress.storeConnectionStrings) details.push('Connection strings stored');
  if (progress.initMigrationTable) details.push('Migration table initialized');
  if (progress.configureDB) details.push('Database configured');

  if (error) {
    details.push(`Error: ${error}`);
  }

  if (completed === 0) return { status: 'pending', details: [] };
  if (completed < total) return { status: 'incomplete', details };
  return { status: 'completed', details };
};

const getRailwayStatus = (config: ProjectConfig): { status: MenuItem['status']; details: string[] } => {
  const { progress, error } = config.railway;
  const completed = Object.values(progress).filter((v) => v === true).length;
  const total = Object.keys(progress).length;

  const details: string[] = [];
  if (progress.selectWorkspace) details.push('Workspace selected');
  if (progress.createProject) details.push('Project created');
  if (progress.deployApi) details.push('API service deployed');
  if (progress.storeApiUrl) details.push('API URL stored');
  if (progress.deployWorker) details.push('Worker service deployed');
  if (progress.provisionRedis) details.push('Redis provisioned');
  if (progress.storeRedisUrl) details.push('Redis URL stored');
  if (progress.setupInfisicalIntegration) details.push('Infisical integration configured');
  if (progress.configureEnvVars) details.push('Environment variables configured');
  if (progress.verifyDeployment) details.push('Deployment verified');

  if (error) {
    details.push(`Error: ${error}`);
  }

  if (completed === 0) return { status: 'pending', details: [] };
  if (completed < total) return { status: 'incomplete', details };
  return { status: 'completed', details };
};

const getVercelStatus = (config: ProjectConfig): { status: MenuItem['status']; details: string[] } => {
  const { progress, error } = config.vercel;
  const completed = Object.values(progress).filter((v) => v === true).length;
  const total = Object.keys(progress).length;

  const details: string[] = [];
  if (progress.selectTeam) details.push('Team selected');
  if (progress.createWebProject) details.push('Web project created');
  if (progress.createAdminProject) details.push('Admin project created');
  if (progress.createSuperadminProject) details.push('Superadmin project created');
  if (progress.linkGitHub) details.push('GitHub linked');
  if (progress.configureEnvVars) details.push('Environment variables configured');
  if (progress.deployProduction) details.push('Production deployment complete');

  if (error) {
    details.push(`Error: ${error}`);
  }

  if (completed === 0) return { status: 'pending', details: [] };
  if (completed < total) return { status: 'incomplete', details };
  return { status: 'completed', details };
};

const DEFAULT_ITEMS: MenuItem[] = [
  { label: '1. Project Configuration', value: 'project-config', status: 'pending' },
  { label: '2. Infisical Setup', value: 'infisical', status: 'pending' },
  { label: '3. PlanetScale Setup', value: 'planetscale', status: 'pending' },
  { label: '4. Railway Setup', value: 'railway', status: 'pending' },
  { label: '5. Vercel Setup', value: 'vercel', status: 'pending' },
  { label: '6. Resend Setup', value: 'resend', status: 'pending' },
  { label: '7. Optional Integrations', value: 'integrations', status: 'pending' },
  { label: '8. DNS Configuration', value: 'dns', status: 'pending' },
  { label: '9. Database Seeding', value: 'seeding', status: 'pending' },
  { label: '10. GitHub Actions Setup', value: 'github-actions', status: 'pending' },
  { label: '11. Final Verification', value: 'verification', status: 'pending' },
  { label: '12. Documentation Generation', value: 'documentation', status: 'pending' },
  { label: '13. Exit', value: 'exit', status: 'pending' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectTask }) => {
  const { config } = useConfig();
  const [items, setItems] = useState<MenuItem[]>(DEFAULT_ITEMS);

  // Calculate initial index from items
  const initialIndex = useMemo(() => {
    const firstIncompleteIndex = items.findIndex((item) => item.status !== 'completed');
    return firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;
  }, [items]);

  useEffect(() => {
    if (!config) return;

    const updateItems = () => {
      const cfg = config;

      // Derive status from config
      const projectConfigStatus = getProjectConfigStatus(cfg);
      const infisicalStatus = getInfisicalStatus(cfg);
      const planetscaleStatus = getPlanetScaleStatus(cfg);
      const railwayStatus = getRailwayStatus(cfg);
      const vercelStatus = getVercelStatus(cfg);

      const updatedItems = [
        {
          label: '1. Project Configuration',
          value: 'project-config',
          status: projectConfigStatus,
        },
        {
          label: '2. Infisical Setup',
          value: 'infisical',
          status: infisicalStatus.status,
          progressDetails: infisicalStatus.details,
        },
        {
          label: '3. PlanetScale Setup',
          value: 'planetscale',
          status: planetscaleStatus.status,
          progressDetails: planetscaleStatus.details,
        },
        {
          label: '4. Railway Setup',
          value: 'railway',
          status: railwayStatus.status,
        },
        {
          label: '5. Vercel Setup',
          value: 'vercel',
          status: vercelStatus.status,
          progressDetails: vercelStatus.details,
        },
        { label: '6. Resend Setup', value: 'resend', status: 'pending' },
        { label: '7. Optional Integrations', value: 'integrations', status: 'pending' },
        { label: '8. DNS Configuration', value: 'dns', status: 'pending' },
        { label: '9. Database Seeding', value: 'seeding', status: 'pending' },
        { label: '10. GitHub Actions Setup', value: 'github-actions', status: 'pending' },
        { label: '11. Final Verification', value: 'verification', status: 'pending' },
        { label: '12. Documentation Generation', value: 'documentation', status: 'pending' },
        { label: '13. Exit', value: 'exit', status: 'pending' },
      ];

      setItems(updatedItems);
    };

    updateItems();
  }, [config]);

  const itemComponent = ({ isSelected, label }: { isSelected: boolean; label: string }) => {
    // Find the item to get its status
    const item = items.find((i) => i.label === label);
    const statusIcon = item?.status === 'completed' ? '✓' : item?.status === 'incomplete' ? '⋯' : ' ';
    const prefix = isSelected ? '❯ ' : '  ';

    return (
      <Text
        color={
          isSelected
            ? 'cyan'
            : item?.status === 'completed'
              ? 'green'
              : item?.status === 'incomplete'
                ? 'yellow'
                : undefined
        }
      >
        {prefix}
        {statusIcon} {label}
      </Text>
    );
  };

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Setup Tasks
        </Text>
      </Box>

      <SelectInput
        key={initialIndex}
        items={items}
        itemComponent={itemComponent}
        indicatorComponent={() => null}
        onSelect={(item) => onSelectTask(item.value)}
        initialIndex={initialIndex}
      />

      <Box marginTop={1}>
        <Text dimColor>{prompt(['navigate', 'select'])}</Text>
      </Box>
    </Box>
  );
};
