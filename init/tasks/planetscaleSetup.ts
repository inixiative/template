import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { planetscaleApi } from '../api/planetscale';
import { getProjectConfig } from '../utils/getProjectConfig';

const execAsync = promisify(exec);

/**
 * Initialize Prisma migration table in the database
 * Uses Bun script with Prisma client to connect and create table
 */
const initPrismaMigrationTable = async (connectionString: string): Promise<void> => {
  try {
    await execAsync(`bun scripts/db/initMigrationTable.ts "${connectionString}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
  } catch (error) {
    throw new Error(
      `Failed to initialize Prisma migration table: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

import {
  clearAllProgress,
  clearConfigError,
  isProgressComplete,
  setConfigError,
  setProgressComplete,
  updateConfigField,
} from '../utils/configHelpers';
import { delay } from '../utils/delay';
import { retryWithTimeout } from '../utils/retry';
import { getSecretAsync, setSecretAsync } from './infisicalSetup';

type SetupResult = {
  databaseName: string;
  productionBranch: {
    name: string;
    connectionString: string;
  };
  stagingBranch: {
    name: string;
    connectionString: string;
  };
};

/**
 * Callback for reporting step progress.
 * Called with no args when a step completes (triggers config re-read).
 * Called with an action string to update the active action label shown in the UI.
 */
export type StepCallback = (action?: string) => Promise<void>;

/**
 * Setup PlanetScale database with branching
 */
export const setupPlanetScale = async (
  selectedOrgName: string,
  onStepComplete?: StepCallback,
): Promise<SetupResult> => {
  try {
    const config = await getProjectConfig();
    const configProjectName = config.project.name;
    const databaseName = configProjectName; // Use project name as database name
    const infisicalProjectId = config.infisical.projectId;

    if (!infisicalProjectId) {
      throw new Error('Infisical project not configured. Run Infisical setup first.');
    }

    // Clear any previous error
    await clearConfigError('planetscale');

    // Check if config is stale (project name changed since last setup)
    const isStale = config.planetscale.configProjectName && config.planetscale.configProjectName !== configProjectName;

    if (isStale) {
      // Clearing stale config (project name changed)
      await updateConfigField('planetscale', 'organization', '');
      await updateConfigField('planetscale', 'database', '');
      await updateConfigField('planetscale', 'tokenId', '');
      await updateConfigField('planetscale', 'configProjectName', '');
      await clearAllProgress('planetscale');
    }

    // Variables to hold intermediate results
    let organization = config.planetscale.organization;
    const region = config.planetscale.region;
    let _database = config.planetscale.database;
    const _tokenId = config.planetscale.tokenId;

    // Step 0: Store organization and mark selected
    if (!(await isProgressComplete('planetscale', 'selectOrg'))) {
      organization = selectedOrgName;
      await updateConfigField('planetscale', 'organization', organization);
      await updateConfigField('planetscale', 'configProjectName', configProjectName);
      await setProgressComplete('planetscale', 'selectOrg');
      await onStepComplete?.();
    }

    // Step 0.5: Region selection (handled by view - just check if complete)
    if (!(await isProgressComplete('planetscale', 'selectRegion'))) {
      throw new Error('Region required but not provided. Please restart setup.');
    }

    // Step 1: Service token (handled by view - just skip if already complete)
    // Token is prompted in the view and stored before this function is called
    if (
      !(await isProgressComplete('planetscale', 'recordTokenId')) ||
      !(await isProgressComplete('planetscale', 'storeOrganizationSecret')) ||
      !(await isProgressComplete('planetscale', 'storeRegionSecret')) ||
      !(await isProgressComplete('planetscale', 'storeTokenIdSecret')) ||
      !(await isProgressComplete('planetscale', 'storeTokenSecret'))
    ) {
      throw new Error('Service token required but not provided. Please restart setup.');
    }

    // Suppressed for TUI: console.log(`\nSetting up PlanetScale database: ${databaseName}`);
    // Suppressed for TUI: console.log(`  Organization: ${organization}`);
    // Step 3: Create or get database
    // NOTE: Database is created with single-node plan (non-HA) for development.
    // IMPORTANT: Before production launch, upgrade to multi-replica plan for HA:
    //   pscale database upgrade-plan <database> --org <org> --plan multi
    //   This provides Primary + 2 replicas with 99.99% SLA
    let _dbResult: Awaited<ReturnType<typeof planetscaleApi.getDatabase>> | undefined;
    if (!(await isProgressComplete('planetscale', 'createDB'))) {
      try {
        _dbResult = await planetscaleApi.createDatabase(organization, databaseName, region);
      } catch (error) {
        // Database might already exist
        if (error instanceof Error && error.message.includes('already exists')) {
          _dbResult = await planetscaleApi.getDatabase(organization, databaseName);
        } else {
          throw error;
        }
      }
      _database = databaseName;

      // Save database name to config immediately so it shows in UI
      await updateConfigField('planetscale', 'database', databaseName);
      await setProgressComplete('planetscale', 'createDB');
      await onStepComplete?.();
    } else {
      // Database already created, just fetch it
      _dbResult = await planetscaleApi.getDatabase(organization, databaseName);
    }

    // Step 4: Wait for database initial provisioning
    // Give PlanetScale time to initialize (branch renaming has its own retry logic)
    await onStepComplete?.('Waiting for database to initialize...');
    await delay(5000);

    // Step 5: Rename main branch to prod
    // This preserves the production status and PS-5 cluster assignment
    if (!(await isProgressComplete('planetscale', 'renameProductionBranch'))) {
      await retryWithTimeout(() => planetscaleApi.renameBranch(organization, databaseName, 'main', 'prod'), {
        maxRetries: 100,
        delayMs: 3000,
        retryCondition: (error) => {
          const msg = error.message.toLowerCase();
          return (
            msg.includes('still initializing') || msg.includes('not ready') || msg.includes('cluster is not ready')
          );
        },
        timeoutMessage: 'Branch rename timed out after 5 minutes - cluster not fully initialized',
        onRetry: async (attempt, maxRetries) => {
          await onStepComplete?.(`Waiting for cluster... attempt ${attempt}/${maxRetries}`);
        },
      });
      await setProgressComplete('planetscale', 'renameProductionBranch');
      await onStepComplete?.();
    }

    // Step 6: Create staging branch (from prod)
    let _stagingBranch: Awaited<ReturnType<typeof planetscaleApi.getBranch>> | undefined;
    if (!(await isProgressComplete('planetscale', 'createStagingBranch'))) {
      try {
        _stagingBranch = await retryWithTimeout(
          () => planetscaleApi.createBranch(organization, databaseName, 'staging', 'prod'),
          {
            maxRetries: 100,
            delayMs: 3000,
            retryCondition: (error) => {
              const msg = error.message.toLowerCase();
              return (
                msg.includes('still initializing') || msg.includes('not ready') || msg.includes('cluster is not ready')
              );
            },
            timeoutMessage: 'Staging branch creation timed out after 5 minutes - cluster not fully initialized',
            onRetry: async (attempt, maxRetries) => {
              await onStepComplete?.(`Waiting for cluster... attempt ${attempt}/${maxRetries}`);
            },
          },
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          _stagingBranch = await planetscaleApi.getBranch(organization, databaseName, 'staging');
        } else {
          throw error;
        }
      }
      await setProgressComplete('planetscale', 'createStagingBranch');
      await onStepComplete?.();
    } else {
      // Staging branch already created, just fetch it
      _stagingBranch = await planetscaleApi.getBranch(organization, databaseName, 'staging');
    }

    // Step 7: Create passwords (connection strings)
    let productionPassword: Awaited<ReturnType<typeof planetscaleApi.createRole>> | undefined;
    let stagingPassword: Awaited<ReturnType<typeof planetscaleApi.createRole>> | undefined;

    if (!(await isProgressComplete('planetscale', 'createProdRole'))) {
      // Production branch role (Postgres uses roles, not passwords)
      await onStepComplete?.('Creating production role...');
      productionPassword = await retryWithTimeout(
        () => planetscaleApi.createRole(organization, databaseName, 'prod', `${configProjectName}-production-init`),
        {
          maxRetries: 100,
          delayMs: 3000,
          retryCondition: (error) => {
            const msg = error.message.toLowerCase();
            return (
              msg.includes('still initializing') || msg.includes('not ready') || msg.includes('cluster is not ready')
            );
          },
          timeoutMessage: 'Production role creation timed out after 5 minutes - cluster not fully initialized',
          onRetry: async (attempt, maxRetries) => {
            await onStepComplete?.(`Creating production role... attempt ${attempt}/${maxRetries}`);
          },
        },
      );
      await setProgressComplete('planetscale', 'createProdRole');
      await onStepComplete?.();
    }

    if (!(await isProgressComplete('planetscale', 'createStagingRole'))) {
      // Staging branch role
      await onStepComplete?.('Creating staging role...');
      stagingPassword = await retryWithTimeout(
        () => planetscaleApi.createRole(organization, databaseName, 'staging', `${configProjectName}-staging-init`),
        {
          maxRetries: 100,
          delayMs: 3000,
          retryCondition: (error) => {
            const msg = error.message.toLowerCase();
            return (
              msg.includes('still initializing') || msg.includes('not ready') || msg.includes('cluster is not ready')
            );
          },
          timeoutMessage: 'Staging role creation timed out after 5 minutes - cluster not fully initialized',
          onRetry: async (attempt, maxRetries) => {
            await onStepComplete?.(`Creating staging role... attempt ${attempt}/${maxRetries}`);
          },
        },
      );
      await setProgressComplete('planetscale', 'createStagingRole');
      await onStepComplete?.();
    }
    // If already complete: passwords exist, connection strings stored in Infisical
    // Later steps fetch from Infisical, so we don't need password objects

    // Step 8: Store connection strings in Infisical
    if (!(await isProgressComplete('planetscale', 'storeProdConnectionString'))) {
      await onStepComplete?.('Storing prod connection string in Infisical...');
      const prodConnectionString = productionPassword?.connection_strings.general;
      if (!prodConnectionString) {
        throw new Error('Production connection string is empty. Check production role creation output.');
      }
      // Store production connection string in prod environment, /api folder
      await setSecretAsync(infisicalProjectId, 'prod', 'DATABASE_URL', prodConnectionString, '/api');
      await setProgressComplete('planetscale', 'storeProdConnectionString');
      await onStepComplete?.();
    }

    if (!(await isProgressComplete('planetscale', 'storeStagingConnectionString'))) {
      await onStepComplete?.('Storing staging connection string in Infisical...');
      const stagingConnectionString = stagingPassword?.connection_strings.general;
      if (!stagingConnectionString) {
        throw new Error('Staging connection string is empty. Check staging role creation output.');
      }
      // Store staging connection string in staging environment, /api folder
      await setSecretAsync(infisicalProjectId, 'staging', 'DATABASE_URL', stagingConnectionString, '/api');
      await setProgressComplete('planetscale', 'storeStagingConnectionString');
      await onStepComplete?.();
    }

    // Step 9: Initialize Prisma migration table (run on both prod and staging)
    if (!(await isProgressComplete('planetscale', 'initProdMigrationTable'))) {
      try {
        // Fetch connection strings from Infisical (source of truth)
        await onStepComplete?.('Fetching prod connection string from Infisical...');
        const prodConnectionString = await getSecretAsync('DATABASE_URL', {
          projectId: infisicalProjectId,
          environment: 'prod',
          path: '/api',
        });

        // Initialize _prisma_migrations table in production branch
        await onStepComplete?.('Initializing migration table (production)...');
        await initPrismaMigrationTable(prodConnectionString);
        await setProgressComplete('planetscale', 'initProdMigrationTable');
        await onStepComplete?.();
      } catch (error) {
        throw new Error(
          `Failed to initialize prod migration table: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (!(await isProgressComplete('planetscale', 'initStagingMigrationTable'))) {
      try {
        await onStepComplete?.('Fetching staging connection string from Infisical...');
        const stagingConnectionString = await getSecretAsync('DATABASE_URL', {
          projectId: infisicalProjectId,
          environment: 'staging',
          path: '/api',
        });

        // Initialize _prisma_migrations table in staging branch
        await onStepComplete?.('Initializing migration table (staging)...');
        await initPrismaMigrationTable(stagingConnectionString);
        await setProgressComplete('planetscale', 'initStagingMigrationTable');
        await onStepComplete?.();
      } catch (error) {
        throw new Error(
          `Failed to initialize staging migration table: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Step 10: Configure database settings (now that migration table exists)
    if (!(await isProgressComplete('planetscale', 'configureDB'))) {
      // Re-read from config (don't trust local variables when resuming)
      const latestConfig = await getProjectConfig();
      const orgName = latestConfig.planetscale.organization;
      const dbName = latestConfig.planetscale.database;

      await planetscaleApi.updateDatabaseSettings(orgName, dbName, {
        allow_foreign_key_constraints: true, // Required for Prisma relations
      });
      await setProgressComplete('planetscale', 'configureDB');
      await onStepComplete?.();
    }

    // Suppressed for TUI: console.log('\n✅ PlanetScale setup complete!');
    // Suppressed for TUI: console.log(`\n📝 Next steps:`);
    // Suppressed for TUI: console.log(`   • Store connection strings in Infisical`);
    // Suppressed for TUI: console.log(`   • Run database migrations`);
    // Suppressed for TUI: console.log(`   • Configure Render/Vercel to use these connections\n`);

    // Fetch connection strings from Infisical (source of truth)
    const prodConnectionString = await getSecretAsync('DATABASE_URL', {
      projectId: infisicalProjectId,
      environment: 'prod',
      path: '/api',
    });

    const stagingConnectionString = await getSecretAsync('DATABASE_URL', {
      projectId: infisicalProjectId,
      environment: 'staging',
      path: '/api',
    });

    return {
      databaseName,
      productionBranch: {
        name: 'prod',
        connectionString: prodConnectionString,
      },
      stagingBranch: {
        name: 'staging',
        connectionString: stagingConnectionString,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await setConfigError('planetscale', errorMsg);
    throw error;
  }
};
