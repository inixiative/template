import { generateKeyPairSync, randomBytes } from 'crypto';
import { ENCRYPTED_MODELS } from '../../packages/db/src/lib/encryption/registry';
import { infisicalApi, toInfisicalSlug } from '../api/infisical';
import { updateConfigField } from '../utils/configHelpers';
import { execAsync } from '../utils/exec';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress, isComplete, markComplete, setError } from '../utils/progressTracking';
import {
  infisicalApiAuthSecretSteps,
  infisicalAppNameSecretSteps,
  infisicalEncryptionKeySteps,
  infisicalFolderSteps,
  infisicalIdentitySecretSteps,
  infisicalInheritanceSteps,
  infisicalWebhookSigningSteps,
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

    // Feature gate: when staging is disabled, skip every staging-scoped folder
    // and inheritance import. The root + prod folders still get created.
    const stagingEnabled = config.features.staging.enabled;

    // Step 4: Create folder structure
    for (const step of infisicalFolderSteps) {
      if (!stagingEnabled && step.environment === 'staging') continue;
      if (await isComplete('infisical', step.action)) continue;

      await infisicalApi.createFolder(projectId, step.environment, step.app, '/');
      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Step 5: Set up inheritance chains
    for (const step of infisicalInheritanceSteps) {
      // Per the steps catalog, every staging-touching import has destination=staging,
      // so guarding only on destinationEnvironment is sufficient (and keeps TS narrowing
      // happy since prod-destination entries can never have a staging source).
      if (!stagingEnabled && step.destinationEnvironment === 'staging') continue;
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
    if (stagingEnabled) {
      await setSecretAsync(projectId, 'staging', 'ENVIRONMENT', 'staging', '/api');
    }

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
      if (!stagingEnabled && step.environment === 'staging') continue;
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

    // Step 7: Ensure webhook signing keypair (RSA-SHA256 per sendWebhook.ts)
    for (const step of infisicalWebhookSigningSteps) {
      if (!stagingEnabled && step.environment === 'staging') continue;
      if (await isComplete('infisical', step.action)) continue;

      let hasKeypair = false;
      try {
        const existing = await getSecretAsync('WEBHOOK_SIGNING_PRIVATE_KEY', {
          projectId,
          environment: step.environment,
          path: '/api',
        });
        hasKeypair = Boolean(existing && existing.includes('PRIVATE KEY'));
      } catch {
        // Missing secret expected on first run.
      }

      if (!hasKeypair) {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
        const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
        await setSecretAsync(projectId, step.environment, 'WEBHOOK_SIGNING_PRIVATE_KEY', privatePem, '/api');
        await setSecretAsync(projectId, step.environment, 'WEBHOOK_SIGNING_PUBLIC_KEY', publicPem, '/api');
      }

      await markComplete('infisical', step.action);
      await onStepComplete?.();
    }

    // Step 8: Ensure encryption keys for every ENCRYPTED_MODELS prefix.
    // Adding a new encrypted model (template-side or downstream) is auto-handled.
    //
    // CREATE-ONLY: if either VERSION or KEY_CURRENT already exists for a prefix,
    // we never overwrite — silently skip. Overwriting an encryption key orphans
    // every existing encrypted row in the DB (decryption fails irrecoverably).
    // Partial state (one set, the other missing) is treated as a hard error so
    // someone notices instead of the script "fixing" it by generating a key
    // that doesn't match the stored ciphertexts.
    //
    // Intentionally no outer `isComplete` short-circuit: ENCRYPTED_MODELS is
    // dynamic, so a previously-complete run wouldn't notice a newly-added
    // prefix. The per-prefix existence check keeps re-runs idempotent and the
    // extra Infisical roundtrips are cheap.
    for (const step of infisicalEncryptionKeySteps) {
      if (!stagingEnabled && step.environment === 'staging') continue;

      const prefixes = new Set<string>();
      for (const modelConfig of Object.values(ENCRYPTED_MODELS)) {
        for (const keyConfig of Object.values(modelConfig.keys)) prefixes.add(keyConfig.envPrefix);
      }

      const fetchOne = async (key: string): Promise<string | null> => {
        try {
          const value = await getSecretAsync(key, {
            projectId,
            environment: step.environment,
            path: '/api',
          });
          return value && value.trim().length > 0 ? value : null;
        } catch {
          return null;
        }
      };

      for (const prefix of prefixes) {
        const versionKey = `${prefix}_ENCRYPTION_VERSION`;
        const currentKey = `${prefix}_ENCRYPTION_KEY_CURRENT`;
        const [existingVersion, existingCurrent] = await Promise.all([fetchOne(versionKey), fetchOne(currentKey)]);

        if (existingVersion && existingCurrent) continue;
        if (existingVersion || existingCurrent) {
          throw new Error(
            `Refusing to overwrite encryption keys for ${prefix} in ${step.environment}: ` +
              `partial state detected (${existingVersion ? versionKey : currentKey} set, other missing). ` +
              `Fix manually before re-running init.`,
          );
        }

        const key = randomBytes(32).toString('base64');
        await setSecretAsync(projectId, step.environment, versionKey, '1', '/api');
        await setSecretAsync(projectId, step.environment, currentKey, key, '/api');
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
  return randomBytes(length).toString('hex');
};

/**
 * Get a secret using Infisical CLI (VCR-backed in tests)
 */
export const getSecretAsync = async (
  key: string,
  options?: {
    projectId?: string;
    environment?: string;
    path?: string;
  },
): Promise<string> => {
  const realFn = async (): Promise<string> => {
    let cmd = `infisical secrets get ${key}`;
    if (options?.projectId) cmd += ` --projectId="${options.projectId}"`;
    if (options?.environment) cmd += ` --env="${options.environment}"`;
    if (options?.path) cmd += ` --path="${options.path}"`;
    cmd += ' --plain';
    const { stdout } = await execAsync(cmd);
    return stdout.trim();
  };

  if (process.env.NODE_ENV === 'test') {
    return infisicalApi.vcr.capture('getSecret', realFn);
  }
  return realFn();
};

/**
 * Set a secret using Infisical CLI (VCR-backed in tests)
 */
export const setSecretAsync = async (
  projectId: string,
  environment: string,
  key: string,
  value: string,
  path: string = '/',
): Promise<void> => {
  const realFn = async (): Promise<void> => {
    await execAsync(
      `infisical secrets set --projectId="${projectId}" --env="${environment}" --path="${path}" "${key}=${value}"`,
    );
  };

  if (process.env.NODE_ENV === 'test') {
    return infisicalApi.vcr.capture('setSecret', realFn);
  }
  return realFn();
};
