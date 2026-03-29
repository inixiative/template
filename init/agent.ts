#!/usr/bin/env bun

/**
 * Agent-accessible init script
 * Non-interactive version for programmatic project initialization
 */

import { setupInfisical } from './tasks/infisicalSetup';
import { setupPlanetScale } from './tasks/planetscaleSetup';
import { renameProject } from './tasks/projectConfig';
import { setupRailway } from './tasks/railwaySetup';
import { isProgressComplete, setProgressComplete, updateConfigField } from './utils/configHelpers';
import { getProjectConfig, writeProjectConfig } from './utils/getProjectConfig';

export type InitConfig = {
  // Project details
  projectName: string;
  organizationName: string;

  // Infisical
  infisicalOrgId: string;

  // PlanetScale
  planetscaleOrg: string;
  planetscaleRegion: string;
  planetscaleTokenId?: string;
  planetscaleToken?: string;

  // Railway
  railwayWorkspaceId: string;
  railwayApiToken?: string;

  // Optional: Callback for progress updates
  onProgress?: (step: string, message: string) => void;
};

export type InitResult = {
  success: boolean;
  message: string;
  details?: {
    infisical?: {
      projectId: string;
      organizationId: string;
    };
    planetscale?: {
      database: string;
      organization: string;
    };
    railway?: {
      projectId: string;
      apiServiceId: string;
      workerServiceId: string;
      redisServiceId: string;
    };
  };
  error?: string;
};

/**
 * Initialize project infrastructure programmatically
 * This is the main entry point for agents and automation
 */
export async function initializeProject(config: InitConfig): Promise<InitResult> {
  try {
    const { onProgress } = config;

    // Step 1: Project Configuration
    onProgress?.('project-config', 'Configuring project name and organization');

    const projectConfig = await getProjectConfig();

    // Update project name if needed
    if (!(await isProgressComplete('project', 'cleanInstall'))) {
      await renameProject(projectConfig.project.name, config.projectName);
    }

    // Update organization name if needed
    if (!(await isProgressComplete('project', 'renameOrg'))) {
      projectConfig.project.organization = config.organizationName;
      await writeProjectConfig(projectConfig);
      await setProgressComplete('project', 'renameOrg');
    }

    // Agent mode provisions remote services only. It does not run `bun run setup`,
    // so the local shell setup flag must remain owned by the interactive flow.

    // Step 2: Infisical Setup
    onProgress?.('infisical', 'Setting up Infisical secrets management');

    const infisicalResult = await setupInfisical(config.infisicalOrgId, async () => {
      onProgress?.('infisical', 'Infisical setup progress...');
    });

    // Step 3: PlanetScale Setup
    onProgress?.('planetscale', 'Setting up PlanetScale database');

    // Store PlanetScale tokens if provided
    if (config.planetscaleTokenId && config.planetscaleToken) {
      const { setSecret } = await import('./tasks/infisicalSetup');
      setSecret(infisicalResult.projectId, 'root', 'PLANETSCALE_TOKEN_ID', config.planetscaleTokenId);
      setSecret(infisicalResult.projectId, 'root', 'PLANETSCALE_TOKEN', config.planetscaleToken);

      // Mark token/bootstrap storage steps as complete
      await updateConfigField('planetscale', 'tokenId', config.planetscaleTokenId);
      await setProgressComplete('planetscale', 'recordTokenId');
      await setProgressComplete('planetscale', 'storeOrganizationSecret');
      await setProgressComplete('planetscale', 'storeRegionSecret');
      await setProgressComplete('planetscale', 'storeTokenIdSecret');
      await setProgressComplete('planetscale', 'storeTokenSecret');

      // Store region
      await updateConfigField('planetscale', 'region', config.planetscaleRegion);
      await setProgressComplete('planetscale', 'selectRegion');
    }

    const planetscaleResult = await setupPlanetScale(config.planetscaleOrg, async () => {
      onProgress?.('planetscale', 'PlanetScale setup progress...');
    });

    // Step 4: Railway Setup
    onProgress?.('railway', 'Setting up Railway hosting');

    // Store Railway token if provided
    if (config.railwayApiToken) {
      const { setSecret } = await import('./tasks/infisicalSetup');
      setSecret(infisicalResult.projectId, 'root', 'RAILWAY_API_TOKEN', config.railwayApiToken);
    }

    const railwayResult = await setupRailway(config.railwayWorkspaceId, async () => {
      onProgress?.('railway', 'Railway setup progress...');
    });

    // Success!
    onProgress?.('complete', 'Project initialization complete');

    return {
      success: true,
      message: 'Project initialized successfully',
      details: {
        infisical: {
          projectId: infisicalResult.projectId,
          organizationId: infisicalResult.organizationId,
        },
        planetscale: {
          database: planetscaleResult.databaseName,
          organization: config.planetscaleOrg,
        },
        railway: {
          projectId: railwayResult.projectId,
          apiServiceId: railwayResult.prodApiServiceId,
          workerServiceId: railwayResult.prodWorkerServiceId,
          redisServiceId: railwayResult.prodRedisServiceId,
        },
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Project initialization failed',
      error: errorMsg,
    };
  }
}

/**
 * Initialize from environment variables
 * Useful for CI/CD and automated setups
 */
export async function initializeFromEnv(): Promise<InitResult> {
  const config: InitConfig = {
    projectName: process.env.PROJECT_NAME || '',
    organizationName: process.env.ORGANIZATION_NAME || '',
    infisicalOrgId: process.env.INFISICAL_ORG_ID || '',
    planetscaleOrg: process.env.PLANETSCALE_ORG || '',
    planetscaleRegion: process.env.PLANETSCALE_REGION || '',
    planetscaleTokenId: process.env.PLANETSCALE_TOKEN_ID,
    planetscaleToken: process.env.PLANETSCALE_TOKEN,
    railwayWorkspaceId: process.env.RAILWAY_WORKSPACE_ID || '',
    railwayApiToken: process.env.RAILWAY_API_TOKEN,
    onProgress: (step, message) => {
      console.log(`[${step}] ${message}`);
    },
  };

  // Validate required fields
  const required = [
    'projectName',
    'organizationName',
    'infisicalOrgId',
    'planetscaleOrg',
    'planetscaleRegion',
    'railwayWorkspaceId',
  ] as const;

  const missing = required.filter((field) => !config[field]);
  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing required environment variables: ${missing.map((f) => f.toUpperCase()).join(', ')}`,
    };
  }

  return initializeProject(config);
}

// If run directly, use environment variables
if (import.meta.main) {
  console.log('🤖 Agent Init - Starting project initialization...\n');

  initializeFromEnv()
    .then((result) => {
      if (result.success) {
        console.log('\n✅', result.message);
        if (result.details) {
          console.log('\nDetails:');
          console.log(JSON.stringify(result.details, null, 2));
        }
        process.exit(0);
      } else {
        console.error('\n❌', result.message);
        if (result.error) {
          console.error('Error:', result.error);
        }
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}
