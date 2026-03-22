import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listOrganizations, listRegions, type PlanetScaleRegion } from '../api/planetscale';
import { ActionSpinner } from '../components/ActionSpinner';
import { type Organization, OrgSelector } from '../components/OrgSelector';
import { StepProgress } from '../components/StepProgress';
import { useAsyncAction } from '../components/useAsyncAction';
import { setSecretAsync } from '../tasks/infisicalSetup';
import { setupPlanetScale } from '../tasks/planetscaleSetup';
import {
  clearAllProgress,
  clearConfigError,
  setConfigError,
  setProgressComplete,
  updateConfigField,
} from '../utils/configHelpers';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { prompt } from '../utils/prompts';

type ViewState = 'status' | 'org-select' | 'region-select' | 'token-confirm' | 'token-id-input' | 'token-value-input';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

type PlanetScaleSetupViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

const detectSetupState = (config: ProjectConfig): SetupState => {
  const { progress, configProjectName } = config.planetscale;
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
  const { progress, organization, region, tokenId, database } = config.planetscale;
  return [
    {
      label: organization ? `Organization selected: ${organization}` : 'Organization selected',
      completed: progress.selectOrg,
    },
    {
      label: region ? `Region selected: ${region}` : 'Region selected',
      completed: progress.selectRegion,
    },
    {
      label: tokenId ? `Service token recorded: ${tokenId}` : 'Service token recorded',
      completed: progress.recordTokenId,
    },
    {
      label: 'PlanetScale organization stored in Infisical',
      completed: progress.storeOrganizationSecret,
    },
    {
      label: 'PlanetScale region stored in Infisical',
      completed: progress.storeRegionSecret,
    },
    {
      label: 'PlanetScale token ID stored in Infisical',
      completed: progress.storeTokenIdSecret,
    },
    {
      label: 'PlanetScale token stored in Infisical',
      completed: progress.storeTokenSecret,
    },
    {
      label: database ? `Database created: ${database}` : 'Database created',
      completed: progress.createDB,
    },
    {
      label: 'Rename main branch to prod',
      completed: progress.renameProductionBranch,
    },
    {
      label: 'Staging branch created',
      completed: progress.createStagingBranch,
    },
    {
      label: 'Prod role created',
      completed: progress.createProdRole,
    },
    {
      label: 'Staging role created',
      completed: progress.createStagingRole,
    },
    {
      label: 'Prod connection string stored in Infisical',
      completed: progress.storeProdConnectionString,
    },
    {
      label: 'Staging connection string stored in Infisical',
      completed: progress.storeStagingConnectionString,
    },
    {
      label: 'Prod migration table initialized',
      completed: progress.initProdMigrationTable,
    },
    {
      label: 'Staging migration table initialized',
      completed: progress.initStagingMigrationTable,
    },
    {
      label: 'Database configured (FK, migrations)',
      completed: progress.configureDB,
    },
  ];
};

export const PlanetScaleSetupView: React.FC<PlanetScaleSetupViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [viewState, setViewState] = useState<ViewState>('status');
  const [running, setRunning] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [regions, setRegions] = useState<PlanetScaleRegion[] | null>(null);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenIdInput, setTokenIdInput] = useState('');
  const tokenAction = useAsyncAction();
  const [activeAction, setActiveAction] = useState<string | undefined>(undefined);

  const isTokenBootstrapComplete = useMemo(() => {
    if (!config) return false;
    const { progress } = config.planetscale;
    return (
      progress.recordTokenId &&
      progress.storeOrganizationSecret &&
      progress.storeRegionSecret &&
      progress.storeTokenIdSecret &&
      progress.storeTokenSecret
    );
  }, [config]);

  // Step callback: no args = step completed (sync config), with string = update action label
  const stepCallback = useCallback(
    async (action?: string) => {
      if (action) {
        setActiveAction(action);
      } else {
        setActiveAction(undefined);
        await syncConfig();
      }
    },
    [syncConfig],
  );

  // Derive setup state from config (no delay)
  const setupState = useMemo(() => (config ? detectSetupState(config) : 'new'), [config]);

  // Load organizations
  useEffect(() => {
    const init = async () => {
      try {
        const orgs = await listOrganizations();
        setOrganizations(orgs);
      } catch (_err) {
        setOrganizations([]);
      } finally {
        setLoadingOrgs(false);
      }
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
    if (!config || !organizations) return;

    if (action === 'restart') {
      // Clear progress, config, and errors
      await updateConfigField('planetscale', 'organization', '');
      await updateConfigField('planetscale', 'database', '');
      await updateConfigField('planetscale', 'tokenId', '');
      await updateConfigField('planetscale', 'configProjectName', '');
      await clearAllProgress('planetscale');
      await clearConfigError('planetscale');

      // Refresh config to clear error display (setupState will auto-update via useMemo)
      await syncConfig();

      // Return to status view
      setViewState('status');

      // Go to org select (or run immediately if 1 org)
      if (organizations.length === 1) {
        await runSetup(organizations[0].name);
      } else {
        setViewState('org-select');
      }
      return;
    }

    if (action === 'continue' || action === 'run') {
      // Clear any previous errors
      await clearConfigError('planetscale');
      await syncConfig();

      // Try to use existing org from config first
      const existingOrg = config.planetscale.organization;
      const _existingRegion = config.planetscale.region;

      if (existingOrg && existingOrg.trim() !== '') {
        // Have org in config - check what's missing
        const { progress } = config.planetscale;

        if (progress.selectOrg && !progress.selectRegion) {
          // Need to select region
          setLoadingRegions(true);
          try {
            const availableRegions = await listRegions(existingOrg);
            setRegions(availableRegions);
            setViewState('region-select');
          } catch (err) {
            await setConfigError('planetscale', err instanceof Error ? err.message : 'Failed to load regions');
            await syncConfig();
            setViewState('status');
          } finally {
            setLoadingRegions(false);
          }
        } else if (progress.selectRegion && !isTokenBootstrapComplete) {
          // Need to create token
          setViewState('token-id-input');
        } else {
          // Run setup
          await runSetup(existingOrg);
        }
      } else if (organizations.length === 0) {
        // No organizations available - set error
        await clearConfigError('planetscale');
        await setConfigError(
          'planetscale',
          'No PlanetScale organizations available. Create one at https://app.planetscale.com',
        );
        await syncConfig();
        setViewState('status'); // Show error on status screen
      } else if (organizations.length === 1) {
        // Single org, run immediately
        await runSetup(organizations[0].name);
      } else {
        // Multiple orgs, show selector
        setViewState('org-select');
      }
    }
  };

  const handleOrgSelect = async (orgName: string) => {
    if (!config || !organizations) return;

    // Find org by name
    const selectedOrg = organizations.find((org) => org.name === orgName);
    if (!selectedOrg) {
      setViewState('status');
      return;
    }

    // Show loading immediately
    setLoadingRegions(true);

    // Clear if org changed
    const currentOrg = config.planetscale.organization;
    if (currentOrg && currentOrg !== selectedOrg.name) {
      await updateConfigField('planetscale', 'organization', '');
      await updateConfigField('planetscale', 'region', '');
      await updateConfigField('planetscale', 'database', '');
      await updateConfigField('planetscale', 'tokenId', '');
      await updateConfigField('planetscale', 'configProjectName', '');
      await clearAllProgress('planetscale');
      await clearConfigError('planetscale');
      await syncConfig();
    }

    // Save org and mark selectOrg as complete
    await updateConfigField('planetscale', 'organization', selectedOrg.name);
    await updateConfigField('planetscale', 'configProjectName', config.project.name);
    await setProgressComplete('planetscale', 'selectOrg');
    await syncConfig();

    // Load regions for this org
    try {
      const availableRegions = await listRegions(selectedOrg.name);
      setRegions(availableRegions);
      setViewState('region-select');
    } catch (err) {
      await setConfigError('planetscale', err instanceof Error ? err.message : 'Failed to load regions');
      await syncConfig();
      setViewState('status');
    } finally {
      setLoadingRegions(false);
    }
  };

  const handleRegionSelect = async (regionSlug: string) => {
    if (!config) return;

    // Save region and mark selectRegion as complete
    await updateConfigField('planetscale', 'region', regionSlug);
    await setProgressComplete('planetscale', 'selectRegion');
    await syncConfig();

    // Show token input (next step)
    setViewState('token-id-input');
  };

  const handleTokenIdSubmit = () => {
    if (!tokenIdInput.trim()) return;
    setViewState('token-value-input');
  };

  const handleTokenValueSubmit = async () => {
    if (!config || !tokenInput.trim() || !tokenIdInput.trim()) return;

    const actionError = await tokenAction.run('Saving to Infisical...', async () => {
      const infisicalProjectId = config.infisical.projectId;
      const orgName = config.planetscale.organization;
      const region = config.planetscale.region;

      if (!config.planetscale.progress.recordTokenId) {
        await updateConfigField('planetscale', 'tokenId', tokenIdInput);
        await setProgressComplete('planetscale', 'recordTokenId');
      }
      if (!config.planetscale.progress.storeOrganizationSecret) {
        await setSecretAsync(infisicalProjectId, 'root', 'PLANETSCALE_ORGANIZATION', orgName);
        await setProgressComplete('planetscale', 'storeOrganizationSecret');
      }
      if (!config.planetscale.progress.storeRegionSecret) {
        await setSecretAsync(infisicalProjectId, 'root', 'PLANETSCALE_REGION', region);
        await setProgressComplete('planetscale', 'storeRegionSecret');
      }
      if (!config.planetscale.progress.storeTokenIdSecret) {
        await setSecretAsync(infisicalProjectId, 'root', 'PLANETSCALE_TOKEN_ID', tokenIdInput);
        await setProgressComplete('planetscale', 'storeTokenIdSecret');
      }
      if (!config.planetscale.progress.storeTokenSecret) {
        await setSecretAsync(infisicalProjectId, 'root', 'PLANETSCALE_TOKEN', tokenInput);
        await setProgressComplete('planetscale', 'storeTokenSecret');
      }
      await syncConfig();

      // Show confirmation screen to verify permissions
      setViewState('token-confirm');
    });

    if (actionError) {
      setViewState('status');
      await setConfigError('planetscale', actionError);
      await syncConfig();
    }
  };

  const handleTokenConfirm = async () => {
    if (!config) return;

    // Continue with setup
    const orgName = config.planetscale.organization;
    await runSetup(orgName);
  };

  const runSetup = async (orgName: string) => {
    // Make sure we're on status view
    setViewState('status');
    setRunning(true);
    setActiveAction(undefined);

    try {
      await setupPlanetScale(orgName, stepCallback);

      // Refresh config to show completed progress (setupState will auto-update via useMemo)
      await syncConfig();

      setActiveAction(undefined);
      setRunning(false);
    } catch (_err) {
      // Error is already persisted by setupPlanetScale via setError
      // Return to status view and refresh to show error
      setViewState('status');
      await syncConfig();
      setActiveAction(undefined);
      setRunning(false);
    }
  };

  // Org selector view
  if (viewState === 'org-select') {
    return (
      <OrgSelector
        organizations={organizations ?? []}
        serviceName="PlanetScale"
        identifierKey="name"
        loading={loadingRegions}
        onSelect={handleOrgSelect}
        onCancel={onCancel}
      />
    );
  }

  // Region selector view
  if (viewState === 'region-select') {
    if (loadingRegions || !regions) {
      return (
        <Box padding={1}>
          <Text>Loading regions...</Text>
        </Box>
      );
    }

    const regionItems = regions.map((region) => ({
      key: region.slug,
      label: `${region.display_name} (${region.slug})`,
      value: region.slug,
    }));

    const regionItemComponent = ({ isSelected = false, label }: { isSelected?: boolean; label: string }) => {
      const prefix = isSelected ? '❯ ' : '  ';
      return (
        <Text color={isSelected ? 'cyan' : undefined}>
          {prefix}
          {label}
        </Text>
      );
    };

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Select PlanetScale Region</Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>Choose a region for your database. Closer regions provide lower latency.</Text>
        </Box>

        <SelectInput
          items={regionItems}
          itemComponent={regionItemComponent}
          indicatorComponent={() => null}
          onSelect={(item) => handleRegionSelect(item.value)}
        />

        <Box marginTop={1}>
          <Text dimColor>Use ↑/↓ to navigate, Enter to select</Text>
        </Box>
      </Box>
    );
  }

  // Token permission confirmation view
  if (viewState === 'token-confirm') {
    const orgName = config?.planetscale.organization || '';

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Confirm Token Permissions</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            ⚠ IMPORTANT: Verify your service token has these permissions:
          </Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>
            Required Permissions:
          </Text>
          <Text> ✓ Create databases</Text>
          <Text> ✓ Create branches</Text>
          <Text> ✓ Create passwords</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>If you're missing any permissions, you'll get a 403 error.</Text>
          <Text dimColor>Check your token at: https://app.planetscale.com/{orgName}/settings/service-tokens</Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>

        <TextInput value="" onChange={() => {}} onSubmit={handleTokenConfirm} />
      </Box>
    );
  }

  // Token ID input view
  if (viewState === 'token-id-input') {
    const orgName = config?.planetscale.organization || '';

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>PlanetScale Service Token</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            Prerequisites:
          </Text>
          <Text dimColor>• Add payment info: https://app.planetscale.com/settings/billing</Text>
          <Text dimColor> (Required for database creation - PS-10 starts at $5/month per database)</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text>Create a service token with database permissions:</Text>
          <Text dimColor>1. Go to: https://app.planetscale.com/{orgName}/settings/service-tokens</Text>
          <Text dimColor>2. Click "New service token"</Text>
          <Text dimColor>3. Enable permissions: Create databases, Create branches, Create passwords</Text>
          <Text dimColor>4. Set expiration to "No expiration"</Text>
          <Text dimColor>5. Copy BOTH the token ID and token value</Text>
        </Box>

        <Box>
          <Text>Token ID: </Text>
          <TextInput value={tokenIdInput} onChange={setTokenIdInput} onSubmit={handleTokenIdSubmit} />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
      </Box>
    );
  }

  // Token value input view
  if (viewState === 'token-value-input') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>PlanetScale Service Token</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Token ID: {tokenIdInput}</Text>
        </Box>

        <Box>
          <Text>Token Value: </Text>
          <TextInput value={tokenInput} onChange={setTokenInput} onSubmit={handleTokenValueSubmit} />
        </Box>

        {tokenAction.running && <ActionSpinner label={tokenAction.actionLabel} />}

        {!tokenAction.running && (
          <Box marginTop={1}>
            <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Loading states
  if (!config || loadingOrgs) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  const progressItems = getProgressDisplay(config);
  const error = config.planetscale.error;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>PlanetScale Setup</Text>

      {/* Error Display - Show prominently at top if error exists */}
      {error && (
        <Box marginTop={1} marginBottom={1}>
          <Text color="red" bold>
            ✗ Error: {error}
          </Text>
        </Box>
      )}

      {/* Progress List - Show ALL steps with active action */}
      <Box marginTop={1}>
        <StepProgress items={progressItems} running={running} activeAction={activeAction} />
      </Box>

      {/* State Message */}
      {setupState === 'stale' && (
        <Box marginTop={1}>
          <Text color="yellow">⚠ Project name changed - config needs update</Text>
        </Box>
      )}

      {config && setupState === 'new' && !running && (
        <Box marginTop={1}>
          <Text dimColor>No PlanetScale database configured</Text>
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
