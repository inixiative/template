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
  const rootFolderCount = [
    progress.createRootApiFolder,
    progress.createRootWebFolder,
    progress.createRootAdminFolder,
    progress.createRootSuperadminFolder,
  ].filter(Boolean).length;
  const stagingFolderCount = [
    progress.createStagingApiFolder,
    progress.createStagingWebFolder,
    progress.createStagingAdminFolder,
    progress.createStagingSuperadminFolder,
  ].filter(Boolean).length;
  const prodFolderCount = [
    progress.createProdApiFolder,
    progress.createProdWebFolder,
    progress.createProdAdminFolder,
    progress.createProdSuperadminFolder,
  ].filter(Boolean).length;
  const stagingInheritanceCount = [
    progress.createStagingApiRootImport,
    progress.createStagingApiRootAppImport,
    progress.createStagingApiEnvImport,
    progress.createStagingWebRootImport,
    progress.createStagingWebRootAppImport,
    progress.createStagingWebEnvImport,
    progress.createStagingAdminRootImport,
    progress.createStagingAdminRootAppImport,
    progress.createStagingAdminEnvImport,
    progress.createStagingSuperadminRootImport,
    progress.createStagingSuperadminRootAppImport,
    progress.createStagingSuperadminEnvImport,
  ].filter(Boolean).length;
  const prodInheritanceCount = [
    progress.createProdApiRootImport,
    progress.createProdApiRootAppImport,
    progress.createProdApiEnvImport,
    progress.createProdWebRootImport,
    progress.createProdWebRootAppImport,
    progress.createProdWebEnvImport,
    progress.createProdAdminRootImport,
    progress.createProdAdminRootAppImport,
    progress.createProdAdminEnvImport,
    progress.createProdSuperadminRootImport,
    progress.createProdSuperadminRootAppImport,
    progress.createProdSuperadminEnvImport,
  ].filter(Boolean).length;

  const details: string[] = [];
  if (progress.selectOrg) details.push('Organization selected');
  if (progress.createProject) details.push('Project created');
  if (progress.renameEnv) details.push('Environments configured');
  if (rootFolderCount === 4) details.push('Root folders created');
  else if (rootFolderCount > 0) details.push(`Root folders created (${rootFolderCount}/4)`);
  if (stagingFolderCount === 4) details.push('Staging folders created');
  else if (stagingFolderCount > 0) details.push(`Staging folders created (${stagingFolderCount}/4)`);
  if (prodFolderCount === 4) details.push('Production folders created');
  else if (prodFolderCount > 0) details.push(`Production folders created (${prodFolderCount}/4)`);
  if (stagingInheritanceCount === 12) details.push('Staging inheritance configured');
  else if (stagingInheritanceCount > 0) details.push(`Staging inheritance configured (${stagingInheritanceCount}/12)`);
  if (prodInheritanceCount === 12) details.push('Production inheritance configured');
  else if (prodInheritanceCount > 0) details.push(`Production inheritance configured (${prodInheritanceCount}/12)`);
  if (progress.ensureProdApiAuthSecret) details.push('Production API auth secret initialized');
  if (progress.ensureStagingApiAuthSecret) details.push('Staging API auth secret initialized');

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
  if (progress.recordTokenId) details.push('Service token recorded');
  if (
    progress.storeOrganizationSecret &&
    progress.storeRegionSecret &&
    progress.storeTokenIdSecret &&
    progress.storeTokenSecret
  )
    details.push('PlanetScale secrets stored in Infisical');
  else {
    if (progress.storeOrganizationSecret) details.push('PlanetScale organization stored');
    if (progress.storeRegionSecret) details.push('PlanetScale region stored');
    if (progress.storeTokenIdSecret) details.push('PlanetScale token ID stored');
    if (progress.storeTokenSecret) details.push('PlanetScale token stored');
  }
  if (progress.createDB) details.push('Database created');
  if (progress.renameProductionBranch) details.push('Production branch renamed');
  if (progress.createStagingBranch) details.push('Staging branch created');
  if (progress.createProdRole && progress.createStagingRole) details.push('Roles created');
  else {
    if (progress.createProdRole) details.push('Prod role created');
    if (progress.createStagingRole) details.push('Staging role created');
  }
  if (progress.storeProdConnectionString && progress.storeStagingConnectionString)
    details.push('Connection strings stored');
  else {
    if (progress.storeProdConnectionString) details.push('Prod connection string stored');
    if (progress.storeStagingConnectionString) details.push('Staging connection string stored');
  }
  if (progress.initProdMigrationTable && progress.initStagingMigrationTable)
    details.push('Migration tables initialized');
  else {
    if (progress.initProdMigrationTable) details.push('Prod migration table initialized');
    if (progress.initStagingMigrationTable) details.push('Staging migration table initialized');
  }
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

  const details: string[] = [];
  if (progress.selectWorkspace) details.push('Workspace selected');
  if (progress.createProject) details.push('Project created');
  if (prodEnvironmentCount === 3) details.push('Production environment ready');
  else if (prodEnvironmentCount > 0) details.push(`Production environment ready (${prodEnvironmentCount}/3)`);
  if (stagingEnvironmentCount === 2) details.push('Staging environment ready');
  else if (stagingEnvironmentCount > 0) details.push(`Staging environment ready (${stagingEnvironmentCount}/2)`);
  if (prodRedisCount === 5) details.push('Production Redis ready');
  else if (prodRedisCount > 0) details.push(`Production Redis ready (${prodRedisCount}/5)`);
  if (stagingRedisCount === 5) details.push('Staging Redis ready');
  else if (stagingRedisCount > 0) details.push(`Staging Redis ready (${stagingRedisCount}/5)`);
  if (prodApiCount === 7) details.push('Production API ready');
  else if (prodApiCount > 0) details.push(`Production API ready (${prodApiCount}/7)`);
  if (stagingApiCount === 7) details.push('Staging API ready');
  else if (stagingApiCount > 0) details.push(`Staging API ready (${stagingApiCount}/7)`);
  if (prodWorkerCount === 6) details.push('Production Worker ready');
  else if (prodWorkerCount > 0) details.push(`Production Worker ready (${prodWorkerCount}/6)`);
  if (stagingWorkerCount === 6) details.push('Staging Worker ready');
  else if (stagingWorkerCount > 0) details.push(`Staging Worker ready (${stagingWorkerCount}/6)`);
  if (progress.createInfisicalConnection) details.push('Infisical integration configured');

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
  const bootstrapCount = [
    progress.selectTeam,
    progress.storeTeamIdSecret,
    progress.storeTeamNameSecret,
    progress.promptedForGithub,
    progress.storeVercelToken,
    progress.createInfisicalConnection,
  ].filter(Boolean).length;

  const details: string[] = [];
  if (bootstrapCount === 6) details.push('Bootstrap ready');
  else if (bootstrapCount > 0) details.push(`Bootstrap ready (${bootstrapCount}/6)`);
  if (progress.createWebProject) details.push('Web project created');
  if (progress.createAdminProject) details.push('Admin project created');
  if (progress.createSuperadminProject) details.push('Superadmin project created');
  if (progress.linkWebGitHub) details.push('GitHub linked');
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

      setItems(updatedItems as MenuItem[]);
    };

    updateItems();
  }, [config]);

  const itemComponent = ({ isSelected = false, label }: { isSelected?: boolean; label: string }) => {
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
