import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { isAppInstalled } from '../api/github';
import { createVercelConnection, ensureVercelSync } from '../api/infisicalVercel';
import {
  checkGitHubIntegration,
  createCustomEnvironment,
  createProject,
  linkGitHub,
  updateProjectSettings,
} from '../api/vercel';
import { updateConfigField } from '../utils/configHelpers';
import { isComplete, markComplete, setError } from '../utils/progressTracking';
import { setSecretAsync } from './infisicalSetup';

/**
 * Get or create Vercel connection in Infisical (idempotent)
 */
const getOrCreateVercelConnection = async (infisicalProjectId: string, projectName: string): Promise<string> => {
  // Get Vercel API token from CLI config
  const authPath = path.join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
  const authContent = await readFile(authPath, 'utf-8');
  const auth = JSON.parse(authContent);
  const vercelToken = auth.token;

  // Store Vercel token in Infisical
  await setSecretAsync(infisicalProjectId, 'root', 'VERCEL_API_TOKEN', vercelToken);

  // Create Vercel connection in Infisical (idempotent)
  const connectionId = await createVercelConnection(
    infisicalProjectId,
    vercelToken,
    `${projectName}-vercel-connection`,
  );

  return connectionId;
};

/**
 * Setup Vercel projects for web, admin, and superadmin apps
 */
export const setupVercel = async (teamId: string, teamName: string, syncConfig: () => Promise<void>): Promise<void> => {
  try {
    const config = (await import('../utils/getProjectConfig')).getProjectConfig();
    const projectConfig = await config;
    const projectName = projectConfig.project.name;
    const infisicalProjectId = projectConfig.infisical.projectId;

    // Step 1: Store team ID and mark progress
    if (!(await isComplete('vercel', 'selectTeam'))) {
      await updateConfigField('vercel', 'teamId', teamId);
      await updateConfigField('vercel', 'teamName', teamName);
      await updateConfigField('vercel', 'configProjectName', projectName);

      // Store team ID and name in Infisical for reference
      await setSecretAsync(infisicalProjectId, 'root', 'VERCEL_TEAM_ID', teamId);
      await setSecretAsync(infisicalProjectId, 'root', 'VERCEL_TEAM_NAME', teamName);

      await markComplete('vercel', 'selectTeam');
      await syncConfig();
    }

    // Step 2: Check GitHub integration (once, before creating projects)
    if (!(await isComplete('vercel', 'promptedForGithub'))) {
      // Check if Vercel GitHub App is installed using GitHub API
      const isVercelAppInstalled = await isAppInstalled(projectConfig.project.organization, 'vercel');

      if (!isVercelAppInstalled) {
        // GitHub App not installed - throw to trigger prompt
        throw new Error('GITHUB_NOT_CONNECTED');
      }

      // Check what GitHub integrations Vercel knows about
      console.log('🔍 Checking Vercel GitHub integrations...');
      await checkGitHubIntegration();

      await markComplete('vercel', 'promptedForGithub');
      await syncConfig();
    }

    // === WEB APP ===

    // Step 3: Create web project
    if (!(await isComplete('vercel', 'createWebProject'))) {
      const webProjectName = `${projectName}-web`;
      const webProject = await createProject(webProjectName, teamId);

      await updateConfigField('vercel', 'webProjectId', webProject.id);
      await markComplete('vercel', 'createWebProject');
      await syncConfig();
    }

    // Step 4: Configure Web root directory
    if (!(await isComplete('vercel', 'configureWebRootDirectory'))) {
      const webProjectId = projectConfig.vercel.webProjectId!;

      await updateProjectSettings(webProjectId, teamId, {
        rootDirectory: 'apps/web',
      });

      await markComplete('vercel', 'configureWebRootDirectory');
      await syncConfig();
    }

    // Step 5: Create Web staging environment (optional - requires Pro/Enterprise)
    if (!(await isComplete('vercel', 'createWebStagingEnvironment'))) {
      const webProjectId = projectConfig.vercel.webProjectId!;

      try {
        await createCustomEnvironment(webProjectId, teamId, 'Staging', 'staging');
        console.log('✅ Created custom staging environment for Web');
      } catch (error) {
        // Gracefully handle if custom environments not available (Hobby plan)
        if (error instanceof Error && error.message.includes('Cannot create more than')) {
          console.log('⚠️  Custom environments not available (requires Pro/Enterprise plan)');
          console.log('   Using Preview environment for staging deployments');
        } else {
          throw error;
        }
      }

      await markComplete('vercel', 'createWebStagingEnvironment');
      await syncConfig();
    }

    // Step 6: Link Web project to GitHub
    if (!(await isComplete('vercel', 'linkWebGitHub'))) {
      const webProjectId = projectConfig.vercel.webProjectId!;

      await linkGitHub(webProjectId, projectConfig.project.organization, projectConfig.project.name, 'main', teamId);

      await markComplete('vercel', 'linkWebGitHub');
      await syncConfig();
    }

    // Step 7: Configure Web branches
    if (!(await isComplete('vercel', 'configureWebBranches'))) {
      const webProjectId = projectConfig.vercel.webProjectId!;

      await updateProjectSettings(webProjectId, teamId, {
        git: {
          deploymentEnabled: {
            '*': false,
            main: true,
          },
        },
      });

      await markComplete('vercel', 'configureWebBranches');
      await syncConfig();
    }

    // Step 8: Create Infisical sync for Web → production
    if (!(await isComplete('vercel', 'createWebInfisicalSyncProd'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const webProjectId = projectConfig.vercel.webProjectId!;

      await ensureVercelSync({
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

    // Step 9: Create Infisical sync for Web → staging (custom environment via preview + branch)
    if (!(await isComplete('vercel', 'createWebInfisicalSyncStaging'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const webProjectId = projectConfig.vercel.webProjectId!;

      await ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-staging-web`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/web',
        vercelProjectId: webProjectId,
        vercelProjectName: `${projectName}-web`,
        vercelEnvironment: 'preview', // Use preview with branch matcher for custom staging
        vercelTeamId: teamId,
        vercelBranch: 'staging', // Target staging branch specifically
      });

      await markComplete('vercel', 'createWebInfisicalSyncStaging');
      await syncConfig();
    }

    // Step 10: Create Infisical sync for Web → preview (optional)
    if (!(await isComplete('vercel', 'createWebInfisicalSyncPreview'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const webProjectId = projectConfig.vercel.webProjectId!;

      await ensureVercelSync({
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

    // === ADMIN APP ===

    // Step 11: Create admin project
    if (!(await isComplete('vercel', 'createAdminProject'))) {
      const adminProjectName = `${projectName}-admin`;
      const adminProject = await createProject(adminProjectName, teamId);

      await updateConfigField('vercel', 'adminProjectId', adminProject.id);
      await markComplete('vercel', 'createAdminProject');
      await syncConfig();
    }

    // Step 12: Configure Admin root directory
    if (!(await isComplete('vercel', 'configureAdminRootDirectory'))) {
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      await updateProjectSettings(adminProjectId, teamId, {
        rootDirectory: 'apps/admin',
      });

      await markComplete('vercel', 'configureAdminRootDirectory');
      await syncConfig();
    }

    // Step 13: Create Admin staging environment (optional - requires Pro/Enterprise)
    if (!(await isComplete('vercel', 'createAdminStagingEnvironment'))) {
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      try {
        await createCustomEnvironment(adminProjectId, teamId, 'Staging', 'staging');
        console.log('✅ Created custom staging environment for Admin');
      } catch (error) {
        // Gracefully handle if custom environments not available (Hobby plan)
        if (error instanceof Error && error.message.includes('Cannot create more than')) {
          console.log('⚠️  Custom environments not available (requires Pro/Enterprise plan)');
          console.log('   Using Preview environment for staging deployments');
        } else {
          throw error;
        }
      }

      await markComplete('vercel', 'createAdminStagingEnvironment');
      await syncConfig();
    }

    // Step 14: Link Admin project to GitHub
    if (!(await isComplete('vercel', 'linkAdminGitHub'))) {
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      await linkGitHub(adminProjectId, projectConfig.project.organization, projectConfig.project.name, 'main', teamId);

      await markComplete('vercel', 'linkAdminGitHub');
      await syncConfig();
    }

    // Step 15: Configure Admin branches
    if (!(await isComplete('vercel', 'configureAdminBranches'))) {
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      await updateProjectSettings(adminProjectId, teamId, {
        git: {
          deploymentEnabled: {
            '*': false,
            main: true,
          },
        },
      });

      await markComplete('vercel', 'configureAdminBranches');
      await syncConfig();
    }

    // Step 16: Create Infisical sync for Admin → production
    if (!(await isComplete('vercel', 'createAdminInfisicalSyncProd'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      await ensureVercelSync({
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

    // Step 17: Create Infisical sync for Admin → staging (custom environment via preview + branch)
    if (!(await isComplete('vercel', 'createAdminInfisicalSyncStaging'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      await ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-staging-admin`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/admin',
        vercelProjectId: adminProjectId,
        vercelProjectName: `${projectName}-admin`,
        vercelEnvironment: 'preview', // Use preview with branch matcher for custom staging
        vercelTeamId: teamId,
        vercelBranch: 'staging', // Target staging branch specifically
      });

      await markComplete('vercel', 'createAdminInfisicalSyncStaging');
      await syncConfig();
    }

    // Step 18: Create Infisical sync for Admin → preview
    if (!(await isComplete('vercel', 'createAdminInfisicalSyncPreview'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const adminProjectId = projectConfig.vercel.adminProjectId!;

      await ensureVercelSync({
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

    // === SUPERADMIN APP ===

    // Step 19: Create superadmin project
    if (!(await isComplete('vercel', 'createSuperadminProject'))) {
      const superadminProjectName = `${projectName}-superadmin`;
      const superadminProject = await createProject(superadminProjectName, teamId);

      await updateConfigField('vercel', 'superadminProjectId', superadminProject.id);
      await markComplete('vercel', 'createSuperadminProject');
      await syncConfig();
    }

    // Step 20: Configure Superadmin root directory
    if (!(await isComplete('vercel', 'configureSuperadminRootDirectory'))) {
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      await updateProjectSettings(superadminProjectId, teamId, {
        rootDirectory: 'apps/superadmin',
      });

      await markComplete('vercel', 'configureSuperadminRootDirectory');
      await syncConfig();
    }

    // Step 21: Create Superadmin staging environment (optional - requires Pro/Enterprise)
    if (!(await isComplete('vercel', 'createSuperadminStagingEnvironment'))) {
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      try {
        await createCustomEnvironment(superadminProjectId, teamId, 'Staging', 'staging');
        console.log('✅ Created custom staging environment for Superadmin');
      } catch (error) {
        // Gracefully handle if custom environments not available (Hobby plan)
        if (error instanceof Error && error.message.includes('Cannot create more than')) {
          console.log('⚠️  Custom environments not available (requires Pro/Enterprise plan)');
          console.log('   Using Preview environment for staging deployments');
        } else {
          throw error;
        }
      }

      await markComplete('vercel', 'createSuperadminStagingEnvironment');
      await syncConfig();
    }

    // Step 22: Link Superadmin project to GitHub
    if (!(await isComplete('vercel', 'linkSuperadminGitHub'))) {
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      await linkGitHub(
        superadminProjectId,
        projectConfig.project.organization,
        projectConfig.project.name,
        'main',
        teamId,
      );

      await markComplete('vercel', 'linkSuperadminGitHub');
      await syncConfig();
    }

    // Step 23: Configure Superadmin branches
    if (!(await isComplete('vercel', 'configureSuperadminBranches'))) {
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      await updateProjectSettings(superadminProjectId, teamId, {
        git: {
          deploymentEnabled: {
            '*': false,
            main: true,
          },
        },
      });

      await markComplete('vercel', 'configureSuperadminBranches');
      await syncConfig();
    }

    // Step 24: Create Infisical sync for Superadmin → production
    if (!(await isComplete('vercel', 'createSuperadminInfisicalSyncProd'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      await ensureVercelSync({
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

    // Step 25: Create Infisical sync for Superadmin → staging (custom environment via preview + branch)
    if (!(await isComplete('vercel', 'createSuperadminInfisicalSyncStaging'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      await ensureVercelSync({
        infisicalProjectId,
        connectionId,
        syncName: `${projectName}-staging-superadmin`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/superadmin',
        vercelProjectId: superadminProjectId,
        vercelProjectName: `${projectName}-superadmin`,
        vercelEnvironment: 'preview', // Use preview with branch matcher for custom staging
        vercelTeamId: teamId,
        vercelBranch: 'staging', // Target staging branch specifically
      });

      await markComplete('vercel', 'createSuperadminInfisicalSyncStaging');
      await syncConfig();
    }

    // Step 26: Create Infisical sync for Superadmin → preview
    if (!(await isComplete('vercel', 'createSuperadminInfisicalSyncPreview'))) {
      const connectionId = await getOrCreateVercelConnection(infisicalProjectId, projectName);
      const superadminProjectId = projectConfig.vercel.superadminProjectId!;

      await ensureVercelSync({
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

    // Step 27: Mark setup complete
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
