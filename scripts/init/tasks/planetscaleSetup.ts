import { execSync } from 'node:child_process';
import {
  createBranch,
  createDatabase,
  createRole,
  getBranch,
  getDatabase,
  renameBranch,
  updateDatabaseSettings,
} from '../api/planetscale';
import { getProjectConfig } from '../utils/getProjectConfig';

/**
 * Initialize Prisma migration table in the database
 * Uses Bun script with Prisma client to connect and create table
 */
const initPrismaMigrationTable = async (connectionString: string): Promise<void> => {
  try {
    execSync(`bun scripts/db/initMigrationTable.ts "${connectionString}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
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
import { retryWithTimeout } from '../utils/retry';
import { getSecret, setSecret } from './infisicalSetup';

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
 * Setup PlanetScale database with branching
 */
export const setupPlanetScale = async (
  selectedOrgName: string,
  onStepComplete?: () => Promise<void>,
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
    if (!(await isProgressComplete('planetscale', 'createToken'))) {
      throw new Error('Service token required but not provided. Please restart setup.');
    }

    // Suppressed for TUI: console.log(`\nSetting up PlanetScale database: ${databaseName}`);
    // Suppressed for TUI: console.log(`  Organization: ${organization}`);
    // Step 3: Create or get database
    // NOTE: Database is created with single-node plan (non-HA) for development.
    // IMPORTANT: Before production launch, upgrade to multi-replica plan for HA:
    //   pscale database upgrade-plan <database> --org <org> --plan multi
    //   This provides Primary + 2 replicas with 99.99% SLA
    let _dbResult: Awaited<ReturnType<typeof getDatabase>> | undefined;
    if (!(await isProgressComplete('planetscale', 'createDB'))) {
      try {
        _dbResult = await createDatabase(organization, databaseName, region);
      } catch (error) {
        // Database might already exist
        if (error instanceof Error && error.message.includes('already exists')) {
          _dbResult = await getDatabase(organization, databaseName);
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
      _dbResult = await getDatabase(organization, databaseName);
    }

    // Step 4: Wait for database initial provisioning
    // Give PlanetScale time to initialize (branch renaming has its own retry logic)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 5: Rename main branch to prod
    // This preserves the production status and PS-5 cluster assignment
    if (!(await isProgressComplete('planetscale', 'renameProductionBranch'))) {
      await retryWithTimeout(() => renameBranch(organization, databaseName, 'main', 'prod'), {
        maxRetries: 100,
        delayMs: 3000,
        retryCondition: (error) => {
          const msg = error.message.toLowerCase();
          return (
            msg.includes('still initializing') || msg.includes('not ready') || msg.includes('cluster is not ready')
          );
        },
        timeoutMessage: 'Branch rename timed out after 5 minutes - cluster not fully initialized',
      });
      await setProgressComplete('planetscale', 'renameProductionBranch');
      await onStepComplete?.();
    }

    // Step 6: Create staging branch (from prod)
    let _stagingBranch: Awaited<ReturnType<typeof getBranch>> | undefined;
    if (!(await isProgressComplete('planetscale', 'createStagingBranch'))) {
      try {
        _stagingBranch = await retryWithTimeout(() => createBranch(organization, databaseName, 'staging', 'prod'), {
          maxRetries: 100,
          delayMs: 3000,
          retryCondition: (error) => {
            const msg = error.message.toLowerCase();
            return (
              msg.includes('still initializing') || msg.includes('not ready') || msg.includes('cluster is not ready')
            );
          },
          timeoutMessage: 'Staging branch creation timed out after 5 minutes - cluster not fully initialized',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          _stagingBranch = await getBranch(organization, databaseName, 'staging');
        } else {
          throw error;
        }
      }
      await setProgressComplete('planetscale', 'createStagingBranch');
      await onStepComplete?.();
    } else {
      // Staging branch already created, just fetch it
      _stagingBranch = await getBranch(organization, databaseName, 'staging');
    }

    // Step 7: Create passwords (connection strings)
    // Suppressed for TUI: console.log('  • Creating connection passwords...');
    let productionPassword: Awaited<ReturnType<typeof createRole>> | undefined;
    let stagingPassword: Awaited<ReturnType<typeof createRole>> | undefined;

    if (!(await isProgressComplete('planetscale', 'createPasswords'))) {
      // Production branch role (Postgres uses roles, not passwords)
      productionPassword = await retryWithTimeout(
        () => createRole(organization, databaseName, 'prod', `${configProjectName}-production-init`),
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
        },
      );

      // Staging branch role
      stagingPassword = await retryWithTimeout(
        () => createRole(organization, databaseName, 'staging', `${configProjectName}-staging-init`),
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
        },
      );
      await setProgressComplete('planetscale', 'createPasswords');
      await onStepComplete?.();
    }
    // If already complete: passwords exist, connection strings stored in Infisical
    // Later steps fetch from Infisical, so we don't need password objects

    // Step 8: Store connection strings in Infisical
    if (!(await isProgressComplete('planetscale', 'storeConnectionStrings'))) {
      const prodConnectionString = productionPassword.connection_strings.general;
      const stagingConnectionString = stagingPassword.connection_strings.general;

      if (!prodConnectionString || !stagingConnectionString) {
        throw new Error('Connection strings are empty. Check password creation output.');
      }

      // Store production connection string in prod environment, /api folder
      setSecret(infisicalProjectId, 'prod', 'DATABASE_URL', prodConnectionString, '/api');

      // Store staging connection string in staging environment, /api folder
      setSecret(infisicalProjectId, 'staging', 'DATABASE_URL', stagingConnectionString, '/api');

      await setProgressComplete('planetscale', 'storeConnectionStrings');
      await onStepComplete?.();
    }

    // Step 9: Initialize Prisma migration table (run on both prod and staging)
    // Uses docker exec to run psql against PlanetScale
    if (!(await isProgressComplete('planetscale', 'initMigrationTable'))) {
      try {
        // Fetch connection strings from Infisical (source of truth)
        const prodConnectionString = getSecret('DATABASE_URL', {
          projectId: infisicalProjectId,
          environment: 'prod',
          path: '/api',
        });

        const stagingConnectionString = getSecret('DATABASE_URL', {
          projectId: infisicalProjectId,
          environment: 'staging',
          path: '/api',
        });

        // Initialize _prisma_migrations table in production branch
        await initPrismaMigrationTable(prodConnectionString);

        // Initialize _prisma_migrations table in staging branch
        await initPrismaMigrationTable(stagingConnectionString);

        await setProgressComplete('planetscale', 'initMigrationTable');
        await onStepComplete?.();
      } catch (error) {
        throw new Error(
          `Failed to initialize migration table: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Step 10: Configure database settings (now that migration table exists)
    if (!(await isProgressComplete('planetscale', 'configureDB'))) {
      // Re-read from config (don't trust local variables when resuming)
      const latestConfig = await getProjectConfig();
      const orgName = latestConfig.planetscale.organization;
      const dbName = latestConfig.planetscale.database;

      await updateDatabaseSettings(orgName, dbName, {
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
    const prodConnectionString = getSecret('DATABASE_URL', {
      projectId: infisicalProjectId,
      environment: 'prod',
      path: '/api',
    });

    const stagingConnectionString = getSecret('DATABASE_URL', {
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
