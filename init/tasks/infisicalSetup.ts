import { infisicalApi, toInfisicalSlug } from '../api/infisical';
import { updateConfigField } from '../utils/configHelpers';
import { execAsync } from '../utils/exec';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress, isComplete, markComplete, setError } from '../utils/progressTracking';
import {
  infisicalApiAuthSecretSteps,
  infisicalAppNameSecretSteps,
  infisicalFolderSteps,
  infisicalIdentitySecretSteps,
  infisicalInheritanceSteps,
} from './infisicalSteps';

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
    await clearError('infisical');

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
      await clearProgress('infisical');
    }

    // Suppressed for TUI: console.log(`\nSetting up Infisical project: ${configProjectName}`);

    // Variables to hold intermediate results
    let organizationId = config.infisical.organizationId;
    let organizationSlug = config.infisical.organizationSlug;
    let projectId = config.infisical.projectId;
    let projectSlug = config.infisical.projectSlug;

    // Step 1: Select organization
    if (!(await isComplete('infisical', 'selectOrg'))) {
      // Suppressed for TUI: console.log('  • Selecting organization...');
      const response = await infisicalApi.getOrganization(selectedOrgId);

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
      await markComplete('infisical', 'selectOrg');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Organization already selected (skipping)');
    }

    // Step 2: Create project
    if (!(await isComplete('infisical', 'createProject'))) {
      // Suppressed for TUI: console.log('  • Creating project...');
      const project = await infisicalApi.upsertProject(configProjectName);
      projectId = project.id;

      // Try to update project slug to match project name
      try {
        await infisicalApi.updateProjectSlug(projectId, toInfisicalSlug(configProjectName));
        // Suppressed for TUI: console.log(`    ✓ Updated slug to: ${configProjectName}`);
      } catch (_error) {
        // Suppressed for TUI: console.log('    ⚠ Could not update slug (may already be correct)');
      }

      // Get final project details to capture actual slug
      const finalProjectDetails = await infisicalApi.getProject(projectId);
      projectSlug =
        (finalProjectDetails as unknown as { workspace?: { slug: string } }).workspace?.slug || project.slug;

      // Update config with project details
      await updateConfigField('infisical', 'projectId', projectId);
      await updateConfigField('infisical', 'projectSlug', projectSlug);
      await updateConfigField('infisical', 'configProjectName', configProjectName);

      // Suppressed for TUI: console.log(`    ✓ Project created: ${configProjectName}`);
      await markComplete('infisical', 'createProject');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Project already created (skipping)');
    }

    // Step 3: Rename dev environment to root
    if (!(await isComplete('infisical', 'renameEnv'))) {
      // Suppressed for TUI: console.log('  • Renaming dev → root...');
      try {
        // Get full project details to find dev environment ID
        const projectDetails = await infisicalApi.getProject(projectId);
        const workspace = (
          projectDetails as unknown as { workspace?: { environments?: Array<{ slug: string; id: string }> } }
        ).workspace;
        const devEnv = workspace?.environments?.find((e: { slug: string; id: string }) => e.slug === 'dev');

        if (devEnv) {
          await infisicalApi.updateEnvironment(projectId, devEnv.id, { name: 'Root', slug: 'root' });
          // Suppressed for TUI: console.log('    ✓ Renamed dev → root');
        } else {
          // Suppressed for TUI: console.log('    ⚠ Dev environment not found (may already be renamed)');
        }
      } catch (_error) {
        // Suppressed for TUI: console.log('    ⚠ Could not rename dev environment:', error instanceof Error ? error.message : error);
      }

      await markComplete('infisical', 'renameEnv');
      await onStepComplete?.();
    } else {
      // Suppressed for TUI: console.log('  ✓ Environments already configured (skipping)');
    }

    // Step 4: Create folder structure
    for (const step of infisicalFolderSteps) {
      if (await isComplete('infisical', step.action)) continue;

      await infisicalApi.createFolder(projectId, step.environment, step.app, '/');
      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Step 5: Set up inheritance chains
    for (const step of infisicalInheritanceSteps) {
      if (await isComplete('infisical', step.action)) continue;

      await infisicalApi.createSecretImport(
        projectId,
        step.destinationEnvironment,
        step.destinationPath,
        step.sourceEnvironment,
        step.sourcePath,
      );
      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Always enforce runtime environment markers used by API/worker.
    // These are idempotent upserts and keep env behavior consistent across reruns.
    await setSecretAsync(projectId, 'root', 'NODE_ENV', 'production', '/');
    await setSecretAsync(projectId, 'prod', 'ENVIRONMENT', 'prod', '/api');
    await setSecretAsync(projectId, 'staging', 'ENVIRONMENT', 'staging', '/api');

    for (const step of infisicalIdentitySecretSteps) {
      if (await isComplete('infisical', step.action)) continue;

      await setSecretAsync(projectId, 'root', step.key, step.getValue(config), step.path);
      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    for (const step of infisicalAppNameSecretSteps) {
      if (await isComplete('infisical', step.action)) continue;

      await setSecretAsync(projectId, 'root', 'VITE_APP_NAME', step.value, step.path);
      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Step 6: Ensure API auth secrets exist for deploy environments
    for (const step of infisicalApiAuthSecretSteps) {
      if (await isComplete('infisical', step.action)) continue;

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

      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Suppressed for TUI: console.log('\n✅ Infisical setup complete!');

    return { projectId, organizationId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    // Suppressed for TUI: console.error('\n❌ Infisical setup failed:', errorMsg);
    await setError('infisical', errorMsg);
    throw error;
  }
};

/**
 * Generate a secure random secret (async, non-blocking)
 */
export const generateSecretAsync = async (length = 32): Promise<string> => {
  const { stdout } = await execAsync(`openssl rand -hex ${length}`);
  return stdout.trim();
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
