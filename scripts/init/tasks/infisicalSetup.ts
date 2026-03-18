import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import {
  createFolder,
  createSecretImport,
  getOrganization,
  getProject,
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

      // Handle nested response structure
      const selectedOrg = response.organization || response;
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
        await updateProjectSlug(projectId, configProjectName);
        // Suppressed for TUI: console.log(`    ✓ Updated slug to: ${configProjectName}`);
      } catch (_error) {
        // Suppressed for TUI: console.log('    ⚠ Could not update slug (may already be correct)');
      }

      // Get final project details to capture actual slug
      const finalProjectDetails = await getProject(projectId);
      projectSlug = finalProjectDetails.workspace?.slug || project.slug;

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
        const devEnv = projectDetails.workspace?.environments?.find(
          (e: { slug: string; id: string }) => e.slug === 'dev',
        );

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
    if (!(await isProgressComplete('infisical', 'createApps'))) {
      // Suppressed for TUI: console.log('  • Creating folder structure...');
      const apps = ['api', 'web', 'admin', 'superadmin'];
      const envs = ['staging', 'prod'];

      for (const env of ['root', ...envs]) {
        for (const app of apps) {
          await createFolder(projectId, env, app, '/');
        }
      }

      // Suppressed for TUI: console.log('    ✓ Folders created: api, web, admin, superadmin');
      await setProgressComplete('infisical', 'createApps');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Folder structure already created (skipping)');
    }

    // Step 5: Set up inheritance chains
    if (!(await isProgressComplete('infisical', 'setInheritance'))) {
      // Suppressed for TUI: console.log('  • Setting up inheritance chains...');
      const apps = ['api', 'web', 'admin', 'superadmin'];
      const envs = ['staging', 'prod'];

      for (const env of envs) {
        for (const app of apps) {
          const destPath = `/${app}`;

          // Import order matters! Create from lowest to highest priority:
          // Priority 1 (lowest): root:/ -> env:/app/
          await createSecretImport(projectId, env, destPath, 'root', '/');

          // Priority 2: root:/app/ -> env:/app/
          await createSecretImport(projectId, env, destPath, 'root', destPath);

          // Priority 3 (highest): env:/ -> env:/app/
          await createSecretImport(projectId, env, destPath, env, '/');
        }
      }

      // Suppressed for TUI: console.log('    ✓ Inheritance: 12 import chains configured');
      await setProgressComplete('infisical', 'setInheritance');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Inheritance already configured (skipping)');
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
    if (!(await isProgressComplete('infisical', 'ensureApiAuthSecrets'))) {
      for (const env of ['prod', 'staging']) {
        try {
          const existing = await getSecretAsync('BETTER_AUTH_SECRET', {
            projectId,
            environment: env,
            path: '/api',
          });
          if (existing && existing.trim().length >= 32) continue;
        } catch {
          // Missing secret is expected on first run.
        }

        const secret = await generateSecretAsync();
        await setSecretAsync(projectId, env, 'BETTER_AUTH_SECRET', secret, '/api');
      }

      await setProgressComplete('infisical', 'ensureApiAuthSecrets');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ API auth secrets already configured (skipping)');
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
