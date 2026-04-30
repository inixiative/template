import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { githubApi } from '../../api/github';
import { infisicalVercelApi } from '../../api/infisicalVercel';
import { vercelApi } from '../../api/vercel';
import { createMockConfig, defaultConfig } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const config = createMockConfig();

const cloneDefaultConfig = (): ProjectConfig => structuredClone(defaultConfig);
const liveTeamId = process.env.VERCEL_TEAM_ID ?? 'team_123';
const _liveTeamSlug = process.env.VERCEL_TEAM_NAME?.toLowerCase().replace(/\s+/g, '-') ?? 'template-team';

config.install();

describe('Vercel Bootstrap Resume Scenario', () => {
  beforeEach(() => {
    infisicalVercelApi.vcr.clear();
    vercelApi.vcr.clear();
    githubApi.vcr.clear();
    config.clearAll();

    config.setConfig({
      ...cloneDefaultConfig(),
      project: {
        ...cloneDefaultConfig().project,
        name: process.env.PROJECT_NAME ?? cloneDefaultConfig().project.name,
        organization: process.env.ORGANIZATION_NAME ?? 'inixiative',
      },
      infisical: {
        ...cloneDefaultConfig().infisical,
        projectId: process.env.INFISICAL_PROJECT_ID ?? 'infisical-proj-id-000',
      },
      vercel: {
        ...cloneDefaultConfig().vercel,
        teamId: liveTeamId,
        teamName: process.env.VERCEL_TEAM_NAME ?? 'Template Team',
        connectionId: '',
        webProjectId: 'web_proj_123',
        adminProjectId: 'admin_proj_123',
        superadminProjectId: 'superadmin_proj_123',
        configProjectName: process.env.PROJECT_NAME ?? cloneDefaultConfig().project.name,
      },
    });

    // All steps complete except createInfisicalConnection
    config.markComplete(
      'vercel',
      Object.keys(defaultConfig.vercel.progress).filter((action) => action !== 'createInfisicalConnection'),
    );

    // listTeams runs unconditionally (line 51 in vercelSetup.ts)
    vercelApi.vcr.queue('listTeams', 'default');
    // createInfisicalConnection not complete → createVercelConnection
    infisicalVercelApi.vcr.queue('createVercelConnection', 'default');
  });

  afterEach(() => {
    infisicalVercelApi.vcr.clear();
    vercelApi.vcr.clear();
    githubApi.vcr.clear();
    config.clearAll();
  });

  test('resumes only the missing Infisical Vercel connection step', async () => {
    const syncConfigMock = async () => {};
    const { setupVercel } = await import(`../vercelSetup?real=${Date.now()}`);

    await setupVercel(liveTeamId, 'Template Team', syncConfigMock);

    // createVercelConnection was called — verified by config update
    expect(config.mocks.updateConfigField).toHaveBeenCalledWith('vercel', 'connectionId', expect.any(String));
    expect(config.mocks.markComplete).toHaveBeenCalledWith('vercel', 'createInfisicalConnection');

    // No other API calls happened — VCR would throw if they did (no cassettes queued)
    expect(infisicalVercelApi.vcr.isEmpty()).toBe(true);
    expect(vercelApi.vcr.isEmpty()).toBe(true);
  }, 60_000);
});
