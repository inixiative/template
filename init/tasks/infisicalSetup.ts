import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import {
  createFolder,
  createSecretImport,
  getOrganization,
  getProject,
  toInfisicalSlug,
  updateEnvironment,
  updateProjectSlug,
  upsertProject,
} from '../api/infisical';
import {
  clearAllProgress,
  clearConfigError,
  isProgressComplete,
  setConfigError,
  setProgressComplete,
  updateConfigField,
} from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';

const execAsync = promisify(exec);

/**
 * Setup Infisical project and environment structure with resume support
 */
export const setupInfisical = async (
  selectedOrgId: string,
  onStepComplete?: () => Promise<void>,
): Promise<{ projectId: string; organizationId: string }> => {
  try {
    const config = await getProjectConfig();
    const configProjectName = config.project.name;

    // Clear any previous error when starting/continuing
    await clearConfigError('infisical');

    // Guard: project name must be set before Infisical setup can run
    if (!configProjectName || configProjectName.trim().length === 0) {
      throw new Error(
        'Project name is not set. Complete "Project Configuration" (step 1) before running Infisical setup.',
      );
    }

    // Check if config is stale (project name changed since last setup)
    const isStale = config.infisical.configProjectName && config.infisical.configProjectName !== configProjectName;

    if (isStale) {
      // Clearing stale config (project name changed)
      await updateConfigField('infisical', 'projectId', '');
      await updateConfigField('infisical', 'organizationId', '');
      await updateConfigField('infisical', 'organizationSlug', '');
      await updateConfigField('infisical', 'projectSlug', '');
      await updateConfigField('infisical', 'configProjectName', '');
      await clearAllProgress('infisical');
    }

    // Suppressed for TUI: console.log(`\nSetting up Infisical project: ${configProjectName}`);

    // Variables to hold intermediate results
    let organizationId = config.infisical.organizationId;
    let organizationSlug = config.infisical.organizationSlug;
    let projectId = config.infisical.projectId;
    let projectSlug = config.infisical.projectSlug;

    // Step 1: Select organization
    if (!(await isProgressComplete('infisical', 'selectOrg'))) {
      // Suppressed for TUI: console.log('  • Selecting organization...');
      const response = await getOrganization(selectedOrgId);

      // Handle nested response structure (API returns { organization: {...} })
      const selectedOrg = (response as unknown as { organization?: typeof response }).organization || response;
      const _orgName = selectedOrg.name || 'Unknown';
      const orgSlug = selectedOrg.slug || selectedOrgId;

      organizationId = selectedOrg.id || selectedOrgId;
      organizationSlug = orgSlug;

      // Update config with org details
      await updateConfigField('infisical', 'organizationId', organizationId);
      await updateConfigField('infisical', 'organizationSlug', organizationSlug);

      // Suppressed for TUI: console.log(`    ✓ Organization: ${orgName} (${organizationSlug})`);
      await setProgressComplete('infisical', 'selectOrg');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Organization already selected (skipping)');
    }

    // Step 2: Create project
    if (!(await isProgressComplete('infisical', 'createProject'))) {
      // Suppressed for TUI: console.log('  • Creating project...');
      const project = await upsertProject(configProjectName);
      projectId = project.id;

      // Try to update project slug to match project name
      try {
        await updateProjectSlug(projectId, toInfisicalSlug(configProjectName));
        // Suppressed for TUI: console.log(`    ✓ Updated slug to: ${configProjectName}`);
      } catch (_error) {
        // Suppressed for TUI: console.log('    ⚠ Could not update slug (may already be correct)');
      }

      // Get final project details to capture actual slug
      const finalProjectDetails = await getProject(projectId);
      projectSlug =
        (finalProjectDetails as unknown as { workspace?: { slug: string } }).workspace?.slug || project.slug;

      // Update config with project details
      await updateConfigField('infisical', 'projectId', projectId);
      await updateConfigField('infisical', 'projectSlug', projectSlug);
      await updateConfigField('infisical', 'configProjectName', configProjectName);

      // Suppressed for TUI: console.log(`    ✓ Project created: ${configProjectName}`);
      await setProgressComplete('infisical', 'createProject');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Project already created (skipping)');
    }

    // Step 3: Rename dev environment to root
    if (!(await isProgressComplete('infisical', 'renameEnv'))) {
      // Suppressed for TUI: console.log('  • Renaming dev → root...');
      try {
        // Get full project details to find dev environment ID
        const projectDetails = await getProject(projectId);
        const workspace = (
          projectDetails as unknown as { workspace?: { environments?: Array<{ slug: string; id: string }> } }
        ).workspace;
        const devEnv = workspace?.environments?.find((e: { slug: string; id: string }) => e.slug === 'dev');

        if (devEnv) {
          await updateEnvironment(projectId, devEnv.id, { name: 'Root', slug: 'root' });
          // Suppressed for TUI: console.log('    ✓ Renamed dev → root');
        } else {
          // Suppressed for TUI: console.log('    ⚠ Dev environment not found (may already be renamed)');
        }
      } catch (_error) {
        // Suppressed for TUI: console.log('    ⚠ Could not rename dev environment:', error instanceof Error ? error.message : error);
      }

      await setProgressComplete('infisical', 'renameEnv');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Environments already configured (skipping)');
    }

    // Step 4: Create folder structure
    const folderSteps = [
      { action: 'createRootApiFolder', environment: 'root', app: 'api' },
      { action: 'createRootWebFolder', environment: 'root', app: 'web' },
      { action: 'createRootAdminFolder', environment: 'root', app: 'admin' },
      { action: 'createRootSuperadminFolder', environment: 'root', app: 'superadmin' },
      { action: 'createStagingApiFolder', environment: 'staging', app: 'api' },
      { action: 'createStagingWebFolder', environment: 'staging', app: 'web' },
      { action: 'createStagingAdminFolder', environment: 'staging', app: 'admin' },
      { action: 'createStagingSuperadminFolder', environment: 'staging', app: 'superadmin' },
      { action: 'createProdApiFolder', environment: 'prod', app: 'api' },
      { action: 'createProdWebFolder', environment: 'prod', app: 'web' },
      { action: 'createProdAdminFolder', environment: 'prod', app: 'admin' },
      { action: 'createProdSuperadminFolder', environment: 'prod', app: 'superadmin' },
    ] as const;

    for (const step of folderSteps) {
      if (await isProgressComplete('infisical', step.action)) continue;

      await createFolder(projectId, step.environment, step.app, '/');
      await setProgressComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Step 5: Set up inheritance chains
    const inheritanceSteps = [
      {
        action: 'createStagingApiRootImport',
        destinationEnvironment: 'staging',
        destinationPath: '/api',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createStagingApiRootAppImport',
        destinationEnvironment: 'staging',
        destinationPath: '/api',
        sourceEnvironment: 'root',
        sourcePath: '/api',
      },
      {
        action: 'createStagingApiEnvImport',
        destinationEnvironment: 'staging',
        destinationPath: '/api',
        sourceEnvironment: 'staging',
        sourcePath: '/',
      },
      {
        action: 'createStagingWebRootImport',
        destinationEnvironment: 'staging',
        destinationPath: '/web',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createStagingWebRootAppImport',
        destinationEnvironment: 'staging',
        destinationPath: '/web',
        sourceEnvironment: 'root',
        sourcePath: '/web',
      },
      {
        action: 'createStagingWebEnvImport',
        destinationEnvironment: 'staging',
        destinationPath: '/web',
        sourceEnvironment: 'staging',
        sourcePath: '/',
      },
      {
        action: 'createStagingAdminRootImport',
        destinationEnvironment: 'staging',
        destinationPath: '/admin',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createStagingAdminRootAppImport',
        destinationEnvironment: 'staging',
        destinationPath: '/admin',
        sourceEnvironment: 'root',
        sourcePath: '/admin',
      },
      {
        action: 'createStagingAdminEnvImport',
        destinationEnvironment: 'staging',
        destinationPath: '/admin',
        sourceEnvironment: 'staging',
        sourcePath: '/',
      },
      {
        action: 'createStagingSuperadminRootImport',
        destinationEnvironment: 'staging',
        destinationPath: '/superadmin',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createStagingSuperadminRootAppImport',
        destinationEnvironment: 'staging',
        destinationPath: '/superadmin',
        sourceEnvironment: 'root',
        sourcePath: '/superadmin',
      },
      {
        action: 'createStagingSuperadminEnvImport',
        destinationEnvironment: 'staging',
        destinationPath: '/superadmin',
        sourceEnvironment: 'staging',
        sourcePath: '/',
      },
      {
        action: 'createProdApiRootImport',
        destinationEnvironment: 'prod',
        destinationPath: '/api',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createProdApiRootAppImport',
        destinationEnvironment: 'prod',
        destinationPath: '/api',
        sourceEnvironment: 'root',
        sourcePath: '/api',
      },
      {
        action: 'createProdApiEnvImport',
        destinationEnvironment: 'prod',
        destinationPath: '/api',
        sourceEnvironment: 'prod',
        sourcePath: '/',
      },
      {
        action: 'createProdWebRootImport',
        destinationEnvironment: 'prod',
        destinationPath: '/web',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createProdWebRootAppImport',
        destinationEnvironment: 'prod',
        destinationPath: '/web',
        sourceEnvironment: 'root',
        sourcePath: '/web',
      },
      {
        action: 'createProdWebEnvImport',
        destinationEnvironment: 'prod',
        destinationPath: '/web',
        sourceEnvironment: 'prod',
        sourcePath: '/',
      },
      {
        action: 'createProdAdminRootImport',
        destinationEnvironment: 'prod',
        destinationPath: '/admin',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createProdAdminRootAppImport',
        destinationEnvironment: 'prod',
        destinationPath: '/admin',
        sourceEnvironment: 'root',
        sourcePath: '/admin',
      },
      {
        action: 'createProdAdminEnvImport',
        destinationEnvironment: 'prod',
        destinationPath: '/admin',
        sourceEnvironment: 'prod',
        sourcePath: '/',
      },
      {
        action: 'createProdSuperadminRootImport',
        destinationEnvironment: 'prod',
        destinationPath: '/superadmin',
        sourceEnvironment: 'root',
        sourcePath: '/',
      },
      {
        action: 'createProdSuperadminRootAppImport',
        destinationEnvironment: 'prod',
        destinationPath: '/superadmin',
        sourceEnvironment: 'root',
        sourcePath: '/superadmin',
      },
      {
        action: 'createProdSuperadminEnvImport',
        destinationEnvironment: 'prod',
        destinationPath: '/superadmin',
        sourceEnvironment: 'prod',
        sourcePath: '/',
      },
    ] as const;

    for (const step of inheritanceSteps) {
      if (await isProgressComplete('infisical', step.action)) continue;

      await createSecretImport(
        projectId,
        step.destinationEnvironment,
        step.destinationPath,
        step.sourceEnvironment,
        step.sourcePath,
      );
      await setProgressComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Always enforce runtime environment markers used by API/worker.
    // These are idempotent upserts and keep env behavior consistent across reruns.
    await setSecretAsync(projectId, 'root', 'NODE_ENV', 'production', '/');
    await setSecretAsync(projectId, 'prod', 'ENVIRONMENT', 'prod', '/api');
    await setSecretAsync(projectId, 'staging', 'ENVIRONMENT', 'staging', '/api');

    // Project identity — shared across all apps/envs via root:/ inheritance
    await setSecretAsync(projectId, 'root', 'PROJECT_NAME', configProjectName, '/');
    await setSecretAsync(projectId, 'root', 'VITE_PROJECT_NAME', configProjectName, '/');

    // Per-app display names — inherited by each app folder
    await setSecretAsync(projectId, 'root', 'VITE_APP_NAME', 'Web', '/web');
    await setSecretAsync(projectId, 'root', 'VITE_APP_NAME', 'Admin', '/admin');
    await setSecretAsync(projectId, 'root', 'VITE_APP_NAME', 'Superadmin', '/superadmin');

    // Step 6: Ensure API auth secrets exist for deploy environments
    const apiAuthSecretSteps = [
      { action: 'ensureProdApiAuthSecret', environment: 'prod' },
      { action: 'ensureStagingApiAuthSecret', environment: 'staging' },
    ] as const;

    for (const step of apiAuthSecretSteps) {
      if (await isProgressComplete('infisical', step.action)) continue;

      let hasValidSecret = false;
      try {
        const existing = await getSecretAsync('BETTER_AUTH_SECRET', {
          projectId,
          environment: step.environment,
          path: '/api',
        });
        hasValidSecret = Boolean(existing && existing.trim().length >= 32);
      } catch {
        // Missing secret is expected on first run.
      }

      if (!hasValidSecret) {
        const secret = await generateSecretAsync();
        await setSecretAsync(projectId, step.environment, 'BETTER_AUTH_SECRET', secret, '/api');
      }

      await setProgressComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Suppressed for TUI: console.log('\n✅ Infisical setup complete!');

    return { projectId, organizationId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    // Suppressed for TUI: console.error('\n❌ Infisical setup failed:', errorMsg);
    await setConfigError('infisical', errorMsg);
    throw error;
  }
};

/**
 * Generate a secure random secret
 */
export const generateSecret = (length = 32): string => {
  return execSync(`openssl rand -hex ${length}`, { encoding: 'utf-8' }).trim();
};

/**
 * Generate a secure random secret (async, non-blocking)
 */
export const generateSecretAsync = async (length = 32): Promise<string> => {
  const { stdout } = await execAsync(`openssl rand -hex ${length}`);
  return stdout.trim();
};

/**
 * Get a secret using Infisical CLI
 */
export const getSecret = (
  key: string,
  options?: {
    projectId?: string;
    environment?: string;
    path?: string;
  },
): string => {
  try {
    let cmd = `infisical secrets get ${key}`;

    if (options?.projectId) {
      cmd += ` --projectId="${options.projectId}"`;
    }
    if (options?.environment) {
      cmd += ` --env="${options.environment}"`;
    }
    if (options?.path) {
      cmd += ` --path="${options.path}"`;
    }

    cmd += ' --plain';

    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to get secret ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get a secret using Infisical CLI (async, non-blocking)
 */
export const getSecretAsync = async (
  key: string,
  options?: {
    projectId?: string;
    environment?: string;
    path?: string;
  },
): Promise<string> => {
  try {
    let cmd = `infisical secrets get ${key}`;

    if (options?.projectId) {
      cmd += ` --projectId="${options.projectId}"`;
    }
    if (options?.environment) {
      cmd += ` --env="${options.environment}"`;
    }
    if (options?.path) {
      cmd += ` --path="${options.path}"`;
    }

    cmd += ' --plain';

    const { stdout } = await execAsync(cmd);
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get secret ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Set a secret using Infisical CLI
 */
export const setSecret = (
  projectId: string,
  environment: string,
  key: string,
  value: string,
  path: string = '/',
): void => {
  try {
    execSync(
      `infisical secrets set --projectId="${projectId}" --env="${environment}" --path="${path}" "${key}=${value}"`,
      {
        stdio: 'pipe',
      },
    );
  } catch (error) {
    throw new Error(`Failed to set secret ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Set a secret using Infisical CLI (async, non-blocking)
 */
export const setSecretAsync = async (
  projectId: string,
  environment: string,
  key: string,
  value: string,
  path: string = '/',
): Promise<void> => {
  try {
    await execAsync(
      `infisical secrets set --projectId="${projectId}" --env="${environment}" --path="${path}" "${key}=${value}"`,
    );
  } catch (error) {
    throw new Error(`Failed to set secret ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
