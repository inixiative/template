import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { infisicalApi } from '../api/infisical';
import { type Organization, OrgSelector } from '../components/OrgSelector';
import { StepProgress } from '../components/StepProgress';
import { setupInfisical } from '../tasks/infisicalSetup';
import { clearAllProgress, clearConfigError, updateConfigField } from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'org-select';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type InfisicalSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
  const { progress, configProjectName, projectId: _projectId } = config.infisical;
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
  const sharedIdentityCount = [
    progress.storeProjectNameSecret,
    progress.storeViteProjectNameSecret,
    progress.storeViteAppShortNameSecret,
  ].filter(Boolean).length;
  const appNameCount = [
    progress.storeWebAppNameSecret,
    progress.storeAdminAppNameSecret,
    progress.storeSuperadminAppNameSecret,
  ].filter(Boolean).length;

  return [
    {
      label: organizationSlug ? `Organization selected: ${organizationSlug}` : 'Organization selected',
      completed: progress.selectOrg,
    },
    {
      label: projectSlug ? `Project created: ${projectSlug}` : 'Project created',
      completed: progress.createProject,
    },
    {
      label: 'Environments configured',
      completed: progress.renameEnv,
    },
    {
      label: `Root app folders created (${rootFolderCount}/4)`,
      completed: rootFolderCount === 4,
    },
    {
      label: `Staging app folders created (${stagingFolderCount}/4)`,
      completed: stagingFolderCount === 4,
    },
    {
      label: `Production app folders created (${prodFolderCount}/4)`,
      completed: prodFolderCount === 4,
    },
    {
      label: `Staging inheritance chains configured (${stagingInheritanceCount}/12)`,
      completed: stagingInheritanceCount === 12,
    },
    {
      label: `Production inheritance chains configured (${prodInheritanceCount}/12)`,
      completed: prodInheritanceCount === 12,
    },
    {
      label: `Shared app identity secrets stored (${sharedIdentityCount}/3)`,
      completed: sharedIdentityCount === 3,
    },
    {
      label: `Per-app display names stored (${appNameCount}/3)`,
      completed: appNameCount === 3,
    },
    {
      label: 'Production API auth secret initialized',
      completed: progress.ensureProdApiAuthSecret,
    },
    {
      label: 'Staging API auth secret initialized',
      completed: progress.ensureStagingApiAuthSecret,
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
      const orgs = await infisicalApi.listOrganizations();
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
        await runSetup(organizations[0].id!);
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
        await runSetup(organizations[0].id!);
      } else {
        // Multiple orgs - show selector
        setViewState('org-select');
      }
    }
  };

  const handleOrgSelect = async (orgId: string) => {
    if (!config) return;

    // Show loading immediately
    setRunning(true);

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

    // Change to status view and run setup
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
        loading={running}
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

  // Guard: project name must be set first
  if (!config.project.name || config.project.name.trim().length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Infisical Setup</Text>
        <Box marginTop={1}>
          <Text color="yellow">⚠ Project name is not set.</Text>
        </Box>
        <Text dimColor>Complete "1. Project Configuration" before running Infisical setup.</Text>
        <Box marginTop={1}>
          <Text dimColor>{prompt(['cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  const progressItems = getProgressDisplay(config);
  const error = config.infisical.error;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Infisical Setup</Text>

      {/* Progress List - Show ALL steps */}
      <Box marginTop={1}>
        <StepProgress items={progressItems} running={running} />
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
                : prompt(['enter', 'restart'])}
          </Text>
        </Box>
      )}
    </Box>
  );
};
