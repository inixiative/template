#!/usr/bin/env bun

// Headless init agent. Runs whole sections of the setup flow without the TUI.
//
//   bun run init:agent                          # runs every section in order
//   bun run init:agent -- --section=infisical   # runs only that section
//
// Each section validates its own env vars, so a `--section=infisical` invocation
// doesn't demand `PLANETSCALE_*` / `RAILWAY_*` to be set. Sections downstream of
// Infisical (planetscale, railway) read the prior projectId from the persisted
// config file, so they can run standalone after a one-time full init.

import { setupInfisical } from './tasks/infisicalSetup';
import { setupPlanetScale } from './tasks/planetscaleSetup';
import { renameProject, updateProjectConfig } from './tasks/projectConfig';
import { setupRailway } from './tasks/railwaySetup';
import { updateConfigField } from './utils/configHelpers';
import { getProjectConfig } from './utils/getProjectConfig';
import { isComplete, markComplete } from './utils/progressTracking';

const SECTIONS = ['project', 'infisical', 'planetscale', 'railway'] as const;
type Section = (typeof SECTIONS)[number];

const parseSection = (): Section | null => {
  const arg = process.argv.find((a) => a.startsWith('--section='));
  if (!arg) return null;
  const value = arg.slice('--section='.length);
  if (!(SECTIONS as readonly string[]).includes(value)) {
    console.error(`Unknown section "${value}". Valid: ${SECTIONS.join(', ')}`);
    process.exit(1);
  }
  return value as Section;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
  return value;
};

const log = (step: string, message: string) => console.log(`[${step}] ${message}`);

const runProject = async (): Promise<void> => {
  const projectName = requireEnv('PROJECT_NAME');
  const organizationName = requireEnv('ORGANIZATION_NAME');
  log('project', 'Configuring project name and organization');

  const projectConfig = await getProjectConfig();
  // Persist name + org before rename so downstream steps read correct values.
  await updateProjectConfig({ name: projectName, organization: organizationName });

  if (!(await isComplete('project', 'cleanInstall'))) {
    await renameProject(projectConfig.project.name, projectName);
  }
  if (!(await isComplete('project', 'renameOrg'))) {
    await markComplete('project', 'renameOrg');
  }
  // Agent mode provisions remote services only — it does not run `bun run setup`,
  // so the local shell setup flag stays owned by the interactive flow.
};

const runInfisical = async (): Promise<void> => {
  const orgId = requireEnv('INFISICAL_ORG_ID');
  log('infisical', 'Setting up Infisical secrets management');
  const result = await setupInfisical(orgId, async () => log('infisical', 'step complete'));
  log('infisical', `projectId=${result.projectId} organizationId=${result.organizationId}`);
};

const runPlanetscale = async (): Promise<void> => {
  const org = requireEnv('PLANETSCALE_ORG');
  const region = requireEnv('PLANETSCALE_REGION');
  const tokenId = process.env.PLANETSCALE_TOKEN_ID;
  const token = process.env.PLANETSCALE_TOKEN;

  log('planetscale', 'Setting up PlanetScale database');

  // Token bootstrap is optional — when supplied, push it into Infisical + mark
  // the corresponding planetscale progress flags so the setup function skips
  // the manual-prompt steps.
  if (tokenId && token) {
    const config = await getProjectConfig();
    if (!config.infisical.projectId) {
      throw new Error('Infisical projectId missing from config — run --section=infisical first.');
    }
    const { setSecretAsync } = await import('./tasks/infisicalSetup');
    await setSecretAsync(config.infisical.projectId, 'root', 'PLANETSCALE_TOKEN_ID', tokenId);
    await setSecretAsync(config.infisical.projectId, 'root', 'PLANETSCALE_TOKEN', token);
    await updateConfigField('planetscale', 'tokenId', tokenId);
    await markComplete('planetscale', 'recordTokenId');
    await markComplete('planetscale', 'storeOrganizationSecret');
    await markComplete('planetscale', 'storeRegionSecret');
    await markComplete('planetscale', 'storeTokenIdSecret');
    await markComplete('planetscale', 'storeTokenSecret');
    await updateConfigField('planetscale', 'region', region);
    await markComplete('planetscale', 'selectRegion');
  }

  const result = await setupPlanetScale(org, async () => log('planetscale', 'step complete'));
  log('planetscale', `database=${result.databaseName}`);
};

const runRailway = async (): Promise<void> => {
  const workspaceId = requireEnv('RAILWAY_WORKSPACE_ID');
  const apiToken = process.env.RAILWAY_API_TOKEN;

  log('railway', 'Setting up Railway hosting');

  if (apiToken) {
    const config = await getProjectConfig();
    if (!config.infisical.projectId) {
      throw new Error('Infisical projectId missing from config — run --section=infisical first.');
    }
    const { setSecretAsync } = await import('./tasks/infisicalSetup');
    await setSecretAsync(config.infisical.projectId, 'root', 'RAILWAY_API_TOKEN', apiToken);
  }

  const result = await setupRailway(workspaceId, async () => log('railway', 'step complete'));
  log(
    'railway',
    `projectId=${result.projectId} prodApiServiceId=${result.prodApiServiceId} prodWorkerServiceId=${result.prodWorkerServiceId}`,
  );
};

if (import.meta.main) {
  const section = parseSection();
  console.log(section ? `🤖 Agent init — section: ${section}\n` : '🤖 Agent init — full flow\n');

  if (!section || section === 'project') await runProject();
  if (!section || section === 'infisical') await runInfisical();
  if (!section || section === 'planetscale') await runPlanetscale();
  if (!section || section === 'railway') await runRailway();

  console.log('\n✅ Done');
}
