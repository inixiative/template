import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { githubApi } from '../api/github';
import { infisicalVercelApi } from '../api/infisicalVercel';
import { vercelApi } from '../api/vercel';
import { updateConfigField, updateConfigFields } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { isComplete, markComplete, setError } from '../utils/progressTracking';
import { setSecretAsync } from './infisicalSetup';

/**
 * Read Vercel API token from local CLI auth config
 */
const readVercelToken = async (): Promise<string> => {
  const authPath = path.join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
  const authContent = await readFile(authPath, 'utf-8');
  const auth = JSON.parse(authContent);
  return auth.token;
};

const buildVercelProductionUrl = (projectName: string, teamSlug: string): string => {
  return `https://${projectName}-${teamSlug}.vercel.app`;
};

const buildVercelBranchUrl = (projectName: string, branchName: string, teamSlug: string): string => {
  return `https://${projectName}-git-${branchName}-${teamSlug}.vercel.app`;
};

/**
 * Setup Vercel projects for web, admin, and superadmin apps
 */
export const setupVercel = async (teamId: string, teamName: string, syncConfig: () => Promise<void>): Promise<void> => {
  try {
    const projectConfig = await getProjectConfig();
    const projectName = projectConfig.project.name;
    const infisicalProjectId = projectConfig.infisical.projectId;
    let webProjectId = projectConfig.vercel.webProjectId;
    let adminProjectId = projectConfig.vercel.adminProjectId;
    let superadminProjectId = projectConfig.vercel.superadminProjectId;
    let connectionId = projectConfig.vercel.connectionId;
    let vercelToken = '';
    const teamSlug = (await vercelApi.listTeams()).find((team) => team.id === teamId)?.slug;

    if (!teamSlug) {
      throw new Error('Could not resolve the selected Vercel team slug. Re-select the team and retry.');
    }

    // Step 1: Store team selection in config
    if (!(await isComplete('vercel', 'selectTeam'))) {
      await updateConfigFields('vercel', { teamId, teamName, configProjectName: projectName });

      await markComplete('vercel', 'selectTeam');
      await syncConfig();
    } else if (!projectConfig.vercel.teamId || !projectConfig.vercel.teamName || !projectConfig.vercel.configProjectName) {
      // Defensive: re-populate config values if they were lost
      await updateConfigFields('vercel', { teamId, teamName, configProjectName: projectName });
      await syncConfig();
    }

    // Step 2: Store team ID in Infisical
    if (!(await isComplete('vercel', 'storeTeamIdSecret'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'VERCEL_TEAM_ID', teamId);
      await markComplete('vercel', 'storeTeamIdSecret');
      await syncConfig();
    }

    // Step 3: Store team name in Infisical
    if (!(await isComplete('vercel', 'storeTeamNameSecret'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'VERCEL_TEAM_NAME', teamName);
      await markComplete('vercel', 'storeTeamNameSecret');
      await syncConfig();
    }

    // Step 4: Check GitHub integration (once, before creating projects)
    if (!(await isComplete('vercel', 'promptedForGithub'))) {
      // Check if Vercel GitHub App is installed using GitHub API
      const isVercelAppInstalled = await githubApi.isAppInstalled(projectConfig.project.organization, 'vercel');

      if (!isVercelAppInstalled) {
        // GitHub App not installed - throw to trigger prompt
        throw new Error('GITHUB_NOT_CONNECTED');
      }

      // Check what GitHub integrations Vercel knows about
      await vercelApi.checkGitHubIntegration();

      await markComplete('vercel', 'promptedForGithub');
      await syncConfig();
    }

    // Step 5: Store Vercel API token in Infisical
    if (!(await isComplete('vercel', 'storeVercelToken'))) {
      vercelToken = await readVercelToken();
      await setSecretAsync(infisicalProjectId, 'root', 'VERCEL_API_TOKEN', vercelToken);
      await markComplete('vercel', 'storeVercelToken');
      await syncConfig();
    }

    // Step 6: Ensure Vercel connection exists in Infisical
    if (!connectionId || !(await isComplete('vercel', 'createInfisicalConnection'))) {
      if (!vercelToken) {
        vercelToken = await readVercelToken();
      }

      if (!connectionId) {
        connectionId = await infisicalVercelApi.createVercelConnection(
          infisicalProjectId,
          vercelToken,
          `${projectName}-vercel-connection`,
        );
        await updateConfigField('vercel', 'connectionId', connectionId);
      }

      await markComplete('vercel', 'createInfisicalConnection');
      await syncConfig();
    }

    // === WEB APP ===

    // Step 7: Create web project (idempotent — finds existing by name on retry)
    if (!(await isComplete('vercel', 'createWebProject'))) {
      const webProjectName = `${projectName}-web`;
      const existing = await vercelApi.getProject(webProjectName, teamId);
      const webProject = existing ?? await vercelApi.createProject(webProjectName, teamId);

      webProjectId = webProject.id;
      await updateConfigField('vercel', 'webProjectId', webProjectId);
      await markComplete('vercel', 'createWebProject');
      await syncConfig();
    }

    // Step 8: Configure Web root directory
    if (!(await isComplete('vercel', 'configureWebRootDirectory'))) {
      await vercelApi.updateProjectSettings(webProjectId, teamId, {
        rootDirectory: 'apps/web',
      });

      await markComplete('vercel', 'configureWebRootDirectory');
      await syncConfig();
    }

    // Step 9: Create Web staging environment (optional - requires Pro/Enterprise)
    if (!(await isComplete('vercel', 'createWebStagingEnvironment'))) {
      try {
        await vercelApi.createCustomEnvironment(webProjectId, teamId, 'Staging', 'main');
      } catch (error) {
        // Gracefully handle if custom environments not available (Hobby plan)
        if (error instanceof Error && error.message.includes('Cannot create more than')) {
        } else {
          throw error;
        }
      }

      await markComplete('vercel', 'createWebStagingEnvironment');
      await syncConfig();
    }

    // Step 10: Link Web project to GitHub
    if (!(await isComplete('vercel', 'linkWebGitHub'))) {
      await vercelApi.linkGitHub(webProjectId, projectConfig.project.organization, projectConfig.project.name, 'main', teamId);

      await markComplete('vercel', 'linkWebGitHub');
      await syncConfig();
    }

    // Step 11: Configure Web branches
    // Branch deploy config lives in apps/web/vercel.json (git.deploymentEnabled).
    // Currently only main deploys; feature branches are skipped to avoid build costs.
    // TODO: When launched, enable preview deploys for PR branches by updating vercel.json
    // or adding a prod branch. See: https://vercel.com/docs/projects/overview#git
    if (!(await isComplete('vercel', 'configureWebBranches'))) {
      await markComplete('vercel', 'configureWebBranches');
      await syncConfig();
    }

    // Step 12: Create Infisical sync for Web → production
    if (!(await isComplete('vercel', 'createWebInfisicalSyncProd'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-prod-web`,
        infisicalEnvironment: 'prod',
        infisicalSecretPath: '/web',
        vercelProjectId: webProjectId,
        vercelProjectName: `${projectName}-web`,
        vercelEnvironment: 'production',
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createWebInfisicalSyncProd');
      await syncConfig();
    }

    // Step 13: Create Infisical sync for Web → staging (custom environment via preview + branch)
    if (!(await isComplete('vercel', 'createWebInfisicalSyncStaging'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-staging-web`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/web',
        vercelProjectId: webProjectId,
        vercelProjectName: `${projectName}-web`,
        vercelEnvironment: 'preview',
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createWebInfisicalSyncStaging');
      await syncConfig();
    }

    // Step 14: Create Infisical sync for Web → preview (optional)
    if (!(await isComplete('vercel', 'createWebInfisicalSyncPreview'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-preview-web`,
        infisicalEnvironment: 'staging', // Use staging secrets for preview
        infisicalSecretPath: '/web',
        vercelProjectId: webProjectId,
        vercelProjectName: `${projectName}-web`,
        vercelEnvironment: 'preview', // Vercel preview environment
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createWebInfisicalSyncPreview');
      await syncConfig();
    }

    if (!(await isComplete('vercel', 'storeProdWebUrls'))) {
      const prodWebUrl = buildVercelProductionUrl(`${projectName}-web`, teamSlug);
      await setSecretAsync(infisicalProjectId, 'prod', 'WEB_URL', prodWebUrl, '/');
      await setSecretAsync(infisicalProjectId, 'prod', 'VITE_WEB_URL', prodWebUrl, '/');
      await markComplete('vercel', 'storeProdWebUrls');
      await syncConfig();
    }

    if (!(await isComplete('vercel', 'storeStagingWebUrls'))) {
      const stagingWebUrl = buildVercelBranchUrl(`${projectName}-web`, 'main', teamSlug);
      await setSecretAsync(infisicalProjectId, 'staging', 'WEB_URL', stagingWebUrl, '/');
      await setSecretAsync(infisicalProjectId, 'staging', 'VITE_WEB_URL', stagingWebUrl, '/');
      await markComplete('vercel', 'storeStagingWebUrls');
      await syncConfig();
    }

    // === ADMIN APP ===

    // Step 15: Create admin project (idempotent — finds existing by name on retry)
    if (!(await isComplete('vercel', 'createAdminProject'))) {
      const adminProjectName = `${projectName}-admin`;
      const existing = await vercelApi.getProject(adminProjectName, teamId);
      const adminProject = existing ?? await vercelApi.createProject(adminProjectName, teamId);

      adminProjectId = adminProject.id;
      await updateConfigField('vercel', 'adminProjectId', adminProjectId);
      await markComplete('vercel', 'createAdminProject');
      await syncConfig();
    }

    // Step 16: Configure Admin root directory
    if (!(await isComplete('vercel', 'configureAdminRootDirectory'))) {
      await vercelApi.updateProjectSettings(adminProjectId, teamId, {
        rootDirectory: 'apps/admin',
      });

      await markComplete('vercel', 'configureAdminRootDirectory');
      await syncConfig();
    }

    // Step 17: Create Admin staging environment (optional - requires Pro/Enterprise)
    if (!(await isComplete('vercel', 'createAdminStagingEnvironment'))) {
      try {
        await vercelApi.createCustomEnvironment(adminProjectId, teamId, 'Staging', 'main');
      } catch (error) {
        // Gracefully handle if custom environments not available (Hobby plan)
        if (error instanceof Error && error.message.includes('Cannot create more than')) {
        } else {
          throw error;
        }
      }

      await markComplete('vercel', 'createAdminStagingEnvironment');
      await syncConfig();
    }

    // Step 18: Link Admin project to GitHub
    if (!(await isComplete('vercel', 'linkAdminGitHub'))) {
      await vercelApi.linkGitHub(adminProjectId, projectConfig.project.organization, projectConfig.project.name, 'main', teamId);

      await markComplete('vercel', 'linkAdminGitHub');
      await syncConfig();
    }

    /// Step 19: Configure Admin branches
    // Branch deploy config lives in apps/admin/vercel.json (git.deploymentEnabled).
    // Currently only main deploys; feature branches skipped to avoid build costs.
    // TODO: Enable preview deploys for PR branches when launched.
    if (!(await isComplete('vercel', 'configureAdminBranches'))) {
      await markComplete('vercel', 'configureAdminBranches');
      await syncConfig();
    }

    // Step 20: Create Infisical sync for Admin → production
    if (!(await isComplete('vercel', 'createAdminInfisicalSyncProd'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-prod-admin`,
        infisicalEnvironment: 'prod',
        infisicalSecretPath: '/admin',
        vercelProjectId: adminProjectId,
        vercelProjectName: `${projectName}-admin`,
        vercelEnvironment: 'production',
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createAdminInfisicalSyncProd');
      await syncConfig();
    }

    // Step 21: Create Infisical sync for Admin → staging (custom environment via preview + branch)
    if (!(await isComplete('vercel', 'createAdminInfisicalSyncStaging'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-staging-admin`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/admin',
        vercelProjectId: adminProjectId,
        vercelProjectName: `${projectName}-admin`,
        vercelEnvironment: 'preview',
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createAdminInfisicalSyncStaging');
      await syncConfig();
    }

    // Step 22: Create Infisical sync for Admin → preview
    if (!(await isComplete('vercel', 'createAdminInfisicalSyncPreview'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-preview-admin`,
        infisicalEnvironment: 'staging', // Use staging secrets for preview
        infisicalSecretPath: '/admin',
        vercelProjectId: adminProjectId,
        vercelProjectName: `${projectName}-admin`,
        vercelEnvironment: 'preview', // Vercel preview environment
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createAdminInfisicalSyncPreview');
      await syncConfig();
    }

    if (!(await isComplete('vercel', 'storeProdAdminUrls'))) {
      const prodAdminUrl = buildVercelProductionUrl(`${projectName}-admin`, teamSlug);
      await setSecretAsync(infisicalProjectId, 'prod', 'ADMIN_URL', prodAdminUrl, '/');
      await setSecretAsync(infisicalProjectId, 'prod', 'VITE_ADMIN_URL', prodAdminUrl, '/');
      await markComplete('vercel', 'storeProdAdminUrls');
      await syncConfig();
    }

    if (!(await isComplete('vercel', 'storeStagingAdminUrls'))) {
      const stagingAdminUrl = buildVercelBranchUrl(`${projectName}-admin`, 'main', teamSlug);
      await setSecretAsync(infisicalProjectId, 'staging', 'ADMIN_URL', stagingAdminUrl, '/');
      await setSecretAsync(infisicalProjectId, 'staging', 'VITE_ADMIN_URL', stagingAdminUrl, '/');
      await markComplete('vercel', 'storeStagingAdminUrls');
      await syncConfig();
    }

    // === SUPERADMIN APP ===

    // Step 23: Create superadmin project (idempotent — finds existing by name on retry)
    if (!(await isComplete('vercel', 'createSuperadminProject'))) {
      const superadminProjectName = `${projectName}-superadmin`;
      const existing = await vercelApi.getProject(superadminProjectName, teamId);
      const superadminProject = existing ?? await vercelApi.createProject(superadminProjectName, teamId);

      superadminProjectId = superadminProject.id;
      await updateConfigField('vercel', 'superadminProjectId', superadminProjectId);
      await markComplete('vercel', 'createSuperadminProject');
      await syncConfig();
    }

    // Step 24: Configure Superadmin root directory
    if (!(await isComplete('vercel', 'configureSuperadminRootDirectory'))) {
      await vercelApi.updateProjectSettings(superadminProjectId, teamId, {
        rootDirectory: 'apps/superadmin',
      });

      await markComplete('vercel', 'configureSuperadminRootDirectory');
      await syncConfig();
    }

    // Step 25: Create Superadmin staging environment (optional - requires Pro/Enterprise)
    if (!(await isComplete('vercel', 'createSuperadminStagingEnvironment'))) {
      try {
        await vercelApi.createCustomEnvironment(superadminProjectId, teamId, 'Staging', 'main');
      } catch (error) {
        // Gracefully handle if custom environments not available (Hobby plan)
        if (error instanceof Error && error.message.includes('Cannot create more than')) {
        } else {
          throw error;
        }
      }

      await markComplete('vercel', 'createSuperadminStagingEnvironment');
      await syncConfig();
    }

    // Step 26: Link Superadmin project to GitHub
    if (!(await isComplete('vercel', 'linkSuperadminGitHub'))) {
      await vercelApi.linkGitHub(
        superadminProjectId,
        projectConfig.project.organization,
        projectConfig.project.name,
        'main',
        teamId,
      );

      await markComplete('vercel', 'linkSuperadminGitHub');
      await syncConfig();
    }

    /// Step 27: Configure Superadmin branches
    // Branch deploy config lives in apps/superadmin/vercel.json (git.deploymentEnabled).
    // Currently only main deploys; feature branches skipped to avoid build costs.
    // TODO: Enable preview deploys for PR branches when launched.
    if (!(await isComplete('vercel', 'configureSuperadminBranches'))) {
      await markComplete('vercel', 'configureSuperadminBranches');
      await syncConfig();
    }

    // Step 28: Create Infisical sync for Superadmin → production
    if (!(await isComplete('vercel', 'createSuperadminInfisicalSyncProd'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-prod-superadmin`,
        infisicalEnvironment: 'prod',
        infisicalSecretPath: '/superadmin',
        vercelProjectId: superadminProjectId,
        vercelProjectName: `${projectName}-superadmin`,
        vercelEnvironment: 'production',
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createSuperadminInfisicalSyncProd');
      await syncConfig();
    }

    // Step 29: Create Infisical sync for Superadmin → staging (custom environment via preview + branch)
    if (!(await isComplete('vercel', 'createSuperadminInfisicalSyncStaging'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-staging-superadmin`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/superadmin',
        vercelProjectId: superadminProjectId,
        vercelProjectName: `${projectName}-superadmin`,
        vercelEnvironment: 'preview',
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createSuperadminInfisicalSyncStaging');
      await syncConfig();
    }

    // Step 30: Create Infisical sync for Superadmin → preview
    if (!(await isComplete('vercel', 'createSuperadminInfisicalSyncPreview'))) {
      await infisicalVercelApi.ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-preview-superadmin`,
        infisicalEnvironment: 'staging', // Use staging secrets for preview
        infisicalSecretPath: '/superadmin',
        vercelProjectId: superadminProjectId,
        vercelProjectName: `${projectName}-superadmin`,
        vercelEnvironment: 'preview', // Vercel preview environment
        vercelTeamId: teamId,
      });

      await markComplete('vercel', 'createSuperadminInfisicalSyncPreview');
      await syncConfig();
    }

    if (!(await isComplete('vercel', 'storeProdSuperadminUrls'))) {
      const prodSuperadminUrl = buildVercelProductionUrl(`${projectName}-superadmin`, teamSlug);
      await setSecretAsync(infisicalProjectId, 'prod', 'SUPERADMIN_URL', prodSuperadminUrl, '/');
      await setSecretAsync(infisicalProjectId, 'prod', 'VITE_SUPERADMIN_URL', prodSuperadminUrl, '/');
      await markComplete('vercel', 'storeProdSuperadminUrls');
      await syncConfig();
    }

    if (!(await isComplete('vercel', 'storeStagingSuperadminUrls'))) {
      const stagingSuperadminUrl = buildVercelBranchUrl(`${projectName}-superadmin`, 'main', teamSlug);
      await setSecretAsync(infisicalProjectId, 'staging', 'SUPERADMIN_URL', stagingSuperadminUrl, '/');
      await setSecretAsync(infisicalProjectId, 'staging', 'VITE_SUPERADMIN_URL', stagingSuperadminUrl, '/');
      await markComplete('vercel', 'storeStagingSuperadminUrls');
      await syncConfig();
    }

    // Step 31: Mark setup complete
    if (!(await isComplete('vercel', 'deployProduction'))) {
      // All done! Projects created, GitHub linked, Infisical synced
      await markComplete('vercel', 'deployProduction');
      await syncConfig();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await setError('vercel', errorMessage);
    await syncConfig();
    throw error;
  }
};
