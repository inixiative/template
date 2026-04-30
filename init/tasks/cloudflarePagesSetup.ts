import { cloudflareApi } from '../api/cloudflare';
import { updateConfigField } from '../utils/configHelpers';
import { execAsync } from '../utils/exec';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, isComplete, markComplete, setError } from '../utils/progressTracking';
import { getSecretAsync, setSecretAsync } from './infisicalSetup';

type AppKey = 'web' | 'admin' | 'superadmin';

/**
 * Provision Cloudflare Pages projects for every enabled FE app.
 *
 * Pre-reqs:
 *   - features.apps.<app>.enabled (toggleable in Settings; default true)
 *   - CLOUDFLARE_API_TOKEN already stored at /CLOUDFLARE_API_TOKEN in
 *     Infisical root (storeApiToken step writes it from the supplied token)
 *   - GitHub repo `${project.organization}/${project.name}` exists
 *
 * Each enabled app gets one Pages project linked to GitHub. Build config
 * targets the per-app build script. Env vars are pulled from Infisical
 * at the matching env+path and pushed to CF as deployment env vars
 * (production env_vars from prod /<app>; preview from staging /<app>).
 */
export const setupCloudflarePages = async (
  selectedAccountId: string,
  apiToken: string,
  onStepComplete?: () => Promise<void>,
): Promise<void> => {
  await clearError('cloudflarePages');

  try {
    const config = await getProjectConfig();
    const project = config.project.name;
    const githubOwner = config.project.organization;
    const githubRepo = config.project.name;
    const infisicalProjectId = config.infisical.projectId;
    const stagingEnabled = config.features.staging.enabled;

    if (!githubOwner) throw new Error('project.organization missing — run Project Configuration first.');
    if (!infisicalProjectId) throw new Error('Infisical not configured. Run Infisical Setup first.');

    // Step 1: store account selection
    if (!(await isComplete('cloudflarePages', 'selectAccount'))) {
      const accounts = await cloudflareApi.listAccounts();
      const selected = accounts.find((a) => a.id === selectedAccountId);
      if (!selected) throw new Error(`Account ${selectedAccountId} not found in token's allowed accounts`);
      await updateConfigField('cloudflarePages', 'accountId', selected.id);
      await updateConfigField('cloudflarePages', 'accountName', selected.name);
      await updateConfigField('cloudflarePages', 'configProjectName', project);
      await markComplete('cloudflarePages', 'selectAccount');
      await onStepComplete?.();
    }

    // Step 2: store API token in Infisical so future re-runs (and Pages
    // deployments via wrangler from CI) can read it without re-prompting.
    if (!(await isComplete('cloudflarePages', 'storeApiToken'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'CLOUDFLARE_API_TOKEN', apiToken, '/');
      await markComplete('cloudflarePages', 'storeApiToken');
      await onStepComplete?.();
    }

    process.env.CLOUDFLARE_API_TOKEN = apiToken;

    const accountId = (await getProjectConfig()).cloudflarePages.accountId;

    const apps: {
      key: AppKey;
      createAction: 'createWebProject' | 'createAdminProject' | 'createSuperadminProject';
      linkAction: 'linkWebGitHub' | 'linkAdminGitHub' | 'linkSuperadminGitHub';
      envProdAction: 'syncWebEnvProd' | 'syncAdminEnvProd' | 'syncSuperadminEnvProd';
      envStagingAction: 'syncWebEnvStaging' | 'syncAdminEnvStaging' | 'syncSuperadminEnvStaging';
      projectField: 'webProjectName' | 'adminProjectName' | 'superadminProjectName';
    }[] = [
      {
        key: 'web',
        createAction: 'createWebProject',
        linkAction: 'linkWebGitHub',
        envProdAction: 'syncWebEnvProd',
        envStagingAction: 'syncWebEnvStaging',
        projectField: 'webProjectName',
      },
      {
        key: 'admin',
        createAction: 'createAdminProject',
        linkAction: 'linkAdminGitHub',
        envProdAction: 'syncAdminEnvProd',
        envStagingAction: 'syncAdminEnvStaging',
        projectField: 'adminProjectName',
      },
      {
        key: 'superadmin',
        createAction: 'createSuperadminProject',
        linkAction: 'linkSuperadminGitHub',
        envProdAction: 'syncSuperadminEnvProd',
        envStagingAction: 'syncSuperadminEnvStaging',
        projectField: 'superadminProjectName',
      },
    ];

    for (const app of apps) {
      const enabled = config.features.apps[app.key].enabled;
      if (!enabled) continue;

      const projectName = `${project}-${app.key}`;

      // Create project + GitHub link in one call (CF Pages combines the two)
      if (!(await isComplete('cloudflarePages', app.createAction))) {
        const existing = await cloudflareApi.getProject(accountId, projectName);
        if (!existing) {
          await cloudflareApi.createProjectFromGitHub(accountId, projectName, {
            githubOwner,
            githubRepo,
            productionBranch: 'main',
            rootDir: `apps/${app.key}`,
            buildCommand: `bun install --frozen-lockfile && bun run --cwd apps/${app.key} build`,
            destinationDir: 'dist',
          });
        }
        await updateConfigField('cloudflarePages', app.projectField, projectName);
        await markComplete('cloudflarePages', app.createAction);
        await onStepComplete?.();
      }
      // linkAction is satisfied by createProjectFromGitHub — flip the flag together.
      if (!(await isComplete('cloudflarePages', app.linkAction))) {
        await markComplete('cloudflarePages', app.linkAction);
        await onStepComplete?.();
      }

      // Push prod env vars from Infisical → CF Pages production env
      if (!(await isComplete('cloudflarePages', app.envProdAction))) {
        const envVars = await fetchEnvVars(infisicalProjectId, 'prod', `/${app.key}`);
        await cloudflareApi.setDeploymentEnvVars(accountId, projectName, 'production', envVars);
        await markComplete('cloudflarePages', app.envProdAction);
        await onStepComplete?.();
      }

      // Push staging env vars (or skip if staging disabled)
      if (stagingEnabled && !(await isComplete('cloudflarePages', app.envStagingAction))) {
        const envVars = await fetchEnvVars(infisicalProjectId, 'staging', `/${app.key}`);
        await cloudflareApi.setDeploymentEnvVars(accountId, projectName, 'preview', envVars);
        await markComplete('cloudflarePages', app.envStagingAction);
        await onStepComplete?.();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setError('cloudflarePages', message);
    throw error;
  }
};

/**
 * Read all VITE_-prefixed secrets from Infisical at the given env+path
 * and return as a flat object suitable for CF Pages env_vars. Other
 * secrets are skipped — CF Pages frontends only need build-time VITE_*
 * vars; backend secrets stay in Infisical.
 */
const fetchEnvVars = async (
  projectId: string,
  env: 'prod' | 'staging',
  path: string,
): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  // Use infisical CLI to dump secrets (exec is already available in init utils).
  const { stdout } = await execAsync(
    `infisical secrets --projectId="${projectId}" --env=${env} --path=${path} --plain`,
    { timeout: 15000 },
  );
  for (const line of stdout.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key.startsWith('VITE_')) result[key] = value;
  }
  // Always inject the API_URL as VITE_API_URL too if not already present —
  // FE apps need it to call the backend.
  if (!result.VITE_API_URL) {
    try {
      const apiUrl = await getSecretAsync('API_URL', { projectId, environment: env, path: '/api' });
      if (apiUrl) result.VITE_API_URL = apiUrl;
    } catch {
      // ignore — API_URL may not exist yet
    }
  }
  return result;
};
