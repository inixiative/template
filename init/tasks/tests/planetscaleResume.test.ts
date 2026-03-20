/**
 * Test: PlanetScale setup resume scenario
 *
 * Verifies that when resuming with passwords already created:
 * 1. Doesn't try to create new roles (would cause "Display name already taken")
 * 2. Fetches connection strings from Infisical
 * 3. Successfully runs initMigrationTable step
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ProjectConfig } from '../../utils/getProjectConfig';

// Create mock functions
const mockIsProgressComplete = mock(async (_section: string, action: string) => {
  const completedSteps = [
    'selectOrg',
    'selectRegion',
    'createToken',
    'setInfisicalToken',
    'createDB',
    'renameProductionBranch',
    'createStagingBranch',
    'createPasswords',
    'storeConnectionStrings',
  ];
  return completedSteps.includes(action);
});
const mockSetProgressComplete = mock(async () => {});
const mockUpdateConfigField = mock(async () => {});
const mockClearConfigError = mock(async () => {});
const mockSetConfigError = mock(async () => {});
const mockClearAllProgress = mock(async () => {});

const mockGetProjectConfig = mock(async () =>
  ({
    project: { name: 'template', organization: 'test-org' },
    infisical: { projectId: 'test-project-id' },
    planetscale: {
      organization: 'inixiative',
      database: 'template',
      region: 'us-east',
      tokenId: 'test-token-id',
    },
  }) as unknown as ProjectConfig,
);

const mockGetSecretAsync = mock(
  async (key: string, options?: { environment?: string; projectId?: string }) => {
    if (key === 'DATABASE_URL') {
      if (options?.environment === 'prod') {
        return 'postgresql://prod-user:prod-pass@aws.connect.psdb.cloud/template?sslmode=require';
      }
      if (options?.environment === 'staging') {
        return 'postgresql://staging-user:staging-pass@aws.connect.psdb.cloud/template?sslmode=require';
      }
    }
    return '';
  },
);
const mockSetSecretAsync = mock(async () => {});
const mockSetSecret = mock(() => {});
const mockGetSecret = mock(() => '');

const mockExec = mock((_cmd: string, _opts: unknown, callback?: unknown) => {
  if (typeof callback === 'function') {
    callback(null, { stdout: '', stderr: '' });
  }
  return {} as ReturnType<typeof import('node:child_process').exec>;
});

const mockGetDatabase = mock(async () => ({
  id: 'db-id',
  name: 'template',
  region: 'us-east',
}));
const mockGetBranch = mock(async () => ({
  id: 'branch-id',
  name: 'main',
  region: 'us-east',
  production: true,
}));
const mockUpdateDatabaseSettings = mock(async () => {});
const mockCreateRole = mock(async () => ({}));

// Mock modules before any imports that depend on them
mock.module('../../utils/configHelpers', () => ({
  isProgressComplete: mockIsProgressComplete,
  setProgressComplete: mockSetProgressComplete,
  updateConfigField: mockUpdateConfigField,
  clearConfigError: mockClearConfigError,
  setConfigError: mockSetConfigError,
  clearAllProgress: mockClearAllProgress,
}));

mock.module('../../utils/getProjectConfig', () => ({
  getProjectConfig: mockGetProjectConfig,
}));

mock.module('../infisicalSetup', () => ({
  getSecretAsync: mockGetSecretAsync,
  setSecretAsync: mockSetSecretAsync,
  setSecret: mockSetSecret,
  getSecret: mockGetSecret,
  setupInfisical: mock(async () => ({ projectId: 'test-project-id', organizationId: 'test-org-id' })),
}));

mock.module('../../api/planetscale', () => ({
  getDatabase: mockGetDatabase,
  getBranch: mockGetBranch,
  updateDatabaseSettings: mockUpdateDatabaseSettings,
  createRole: mockCreateRole,
  listOrganizations: mock(async () => []),
  listRegions: mock(async () => []),
  createDatabase: mock(async () => ({})),
  renameBranch: mock(async () => ({})),
  createBranch: mock(async () => ({})),
}));

mock.module('node:child_process', () => ({
  exec: mockExec,
  execSync: mock(() => ''),
}));

mock.module('node:util', () => ({
  promisify: (fn: unknown) => {
    return async (...args: unknown[]) => {
      const result = (fn as (...a: unknown[]) => unknown)(...args);
      return { stdout: result || '', stderr: '' };
    };
  },
}));

describe('PlanetScale Resume Scenario', () => {
  beforeEach(() => {
    mockIsProgressComplete.mockClear();
    mockSetProgressComplete.mockClear();
    mockUpdateConfigField.mockClear();
    mockClearConfigError.mockClear();
    mockGetProjectConfig.mockClear();
    mockGetSecretAsync.mockClear();
    mockExec.mockClear();
    mockGetDatabase.mockClear();
    mockGetBranch.mockClear();
    mockUpdateDatabaseSettings.mockClear();
    mockCreateRole.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  test('should NOT create new roles when resuming', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    expect(mockCreateRole).not.toHaveBeenCalled();
  });

  test('should fetch connection strings from Infisical', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    expect(mockGetSecretAsync).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'test-project-id',
      environment: 'prod',
      path: '/api',
    });

    expect(mockGetSecretAsync).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'test-project-id',
      environment: 'staging',
      path: '/api',
    });
  });

  test('should run bun script to init migration table', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    const calls = mockExec.mock.calls;
    const migrationCalls = calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('initMigrationTable'),
    );
    expect(migrationCalls).toHaveLength(2);

    expect(migrationCalls[0][0]).toContain('postgresql://prod-user:prod-pass');
    expect(migrationCalls[1][0]).toContain('postgresql://staging-user:staging-pass');
  });

  test('should mark initMigrationTable as complete', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    expect(mockSetProgressComplete).toHaveBeenCalledWith('planetscale', 'initMigrationTable');
  });

  test('should configure database after migration table init', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    expect(mockUpdateDatabaseSettings).toHaveBeenCalledWith('inixiative', 'template', {
      allow_foreign_key_constraints: true,
    });
  });
});
