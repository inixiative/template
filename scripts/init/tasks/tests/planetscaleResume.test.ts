import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

const mockGetProjectConfig = mock(async () => ({
  project: { name: 'template', organization: 'test-org' },
  infisical: { projectId: 'test-project-id' },
  planetscale: {
    organization: 'inixiative',
    database: 'template',
    region: 'us-east',
    tokenId: 'test-token-id',
    configProjectName: 'template',
  },
}));

const mockUpdateConfigField = mock(async () => undefined);
const mockSetProgressComplete = mock(async () => undefined);
const mockClearAllProgress = mock(async () => undefined);
const mockSetConfigError = mock(async () => undefined);
const mockClearConfigError = mock(async () => undefined);
const mockIsProgressComplete = mock(async (_section: string, action: string) => {
  const completedSteps = new Set([
    'selectOrg',
    'selectRegion',
    'createToken',
    'createDB',
    'renameProductionBranch',
    'createStagingBranch',
    'createPasswords',
    'storeConnectionStrings',
  ]);
  return completedSteps.has(action);
});

const mockGetSecret = mock((key: string, options?: { environment?: string }) => {
  if (key === 'DATABASE_URL' && options?.environment === 'prod') {
    return 'postgresql://prod-user:prod-pass@aws.connect.psdb.cloud/template?sslmode=require';
  }
  if (key === 'DATABASE_URL' && options?.environment === 'staging') {
    return 'postgresql://staging-user:staging-pass@aws.connect.psdb.cloud/template?sslmode=require';
  }
  return '';
});
const mockSetSecret = mock(() => undefined);

const mockCreateDatabase = mock(async () => ({ id: 'db-id', name: 'template', region: 'us-east' }));
const mockGetDatabase = mock(async () => ({ id: 'db-id', name: 'template', region: 'us-east' }));
const mockUpdateDatabaseSettings = mock(async () => undefined);
const mockCreateBranch = mock(async () => ({ id: 'branch-id', name: 'staging', region: 'us-east', production: false }));
const mockGetBranch = mock(async () => ({ id: 'branch-id', name: 'staging', region: 'us-east', production: false }));
const mockCreateRole = mock(async () => ({
  id: 'role-id',
  name: 'role',
  username: 'user',
  plain_text: 'pass',
  connection_strings: { general: 'postgresql://role:pass@aws.connect.psdb.cloud/template' },
}));
const mockRenameBranch = mock(async () => ({ id: 'branch-id', name: 'prod', region: 'us-east', production: true }));
const mockDeleteBranch = mock(async () => undefined);
const mockCreateServiceToken = mock(async () => ({ id: 'token-id', token: 'token-value' }));

const mockRetryWithTimeout = mock(async <T>(fn: () => Promise<T>) => fn());
const mockExecSync = mock(() => Buffer.from(''));

mock.module('../../utils/getProjectConfig', () => ({
  getProjectConfig: mockGetProjectConfig,
}));
mock.module('../../utils/configHelpers', () => ({
  updateConfigField: mockUpdateConfigField,
  setProgressComplete: mockSetProgressComplete,
  isProgressComplete: mockIsProgressComplete,
  clearAllProgress: mockClearAllProgress,
  setConfigError: mockSetConfigError,
  clearConfigError: mockClearConfigError,
}));
mock.module('../infisicalSetup', () => ({
  getSecret: mockGetSecret,
  setSecret: mockSetSecret,
}));
mock.module('../../api/planetscale', () => ({
  createDatabase: mockCreateDatabase,
  getDatabase: mockGetDatabase,
  updateDatabaseSettings: mockUpdateDatabaseSettings,
  createBranch: mockCreateBranch,
  getBranch: mockGetBranch,
  createRole: mockCreateRole,
  renameBranch: mockRenameBranch,
  deleteBranch: mockDeleteBranch,
  createServiceToken: mockCreateServiceToken,
}));
mock.module('../../utils/retry', () => ({
  retryWithTimeout: mockRetryWithTimeout,
}));
mock.module('node:child_process', () => ({
  execSync: mockExecSync,
}));

let setupPlanetScale: (selectedOrgName: string, onStepComplete?: () => Promise<void>) => Promise<unknown>;
let setTimeoutSpy: ReturnType<typeof spyOn>;

beforeAll(async () => {
  ({ setupPlanetScale } = await import('../planetscaleSetup'));
});

beforeEach(() => {
  mockGetProjectConfig.mockClear();
  mockUpdateConfigField.mockClear();
  mockSetProgressComplete.mockClear();
  mockClearAllProgress.mockClear();
  mockSetConfigError.mockClear();
  mockClearConfigError.mockClear();
  mockIsProgressComplete.mockClear();
  mockGetSecret.mockClear();
  mockSetSecret.mockClear();
  mockCreateDatabase.mockClear();
  mockGetDatabase.mockClear();
  mockUpdateDatabaseSettings.mockClear();
  mockCreateBranch.mockClear();
  mockGetBranch.mockClear();
  mockCreateRole.mockClear();
  mockRenameBranch.mockClear();
  mockDeleteBranch.mockClear();
  mockCreateServiceToken.mockClear();
  mockRetryWithTimeout.mockClear();
  mockExecSync.mockClear();

  // Avoid the built-in 5s provisioning wait during this focused resume test.
  setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(((fn: (...args: unknown[]) => void) => {
    fn();
    return 0 as unknown as Timer;
  }) as typeof setTimeout);
});

afterEach(() => {
  setTimeoutSpy.mockRestore();
});

describe('PlanetScale Resume Scenario', () => {
  it('does not create new passwords when resuming', async () => {
    await setupPlanetScale('inixiative');
    expect(mockCreateRole).not.toHaveBeenCalled();
  });

  it('fetches connection strings from Infisical', async () => {
    await setupPlanetScale('inixiative');

    expect(mockGetSecret).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'test-project-id',
      environment: 'prod',
      path: '/api',
    });
    expect(mockGetSecret).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'test-project-id',
      environment: 'staging',
      path: '/api',
    });
  });

  it('runs migration-table init command for prod and staging', async () => {
    await setupPlanetScale('inixiative');

    expect(mockExecSync).toHaveBeenCalledTimes(2);
    const calls = mockExecSync.mock.calls;
    expect(calls[0]?.[0]).toContain('scripts/db/init-migration-table.ts');
    expect(calls[0]?.[0]).toContain('postgresql://prod-user:prod-pass');
    expect(calls[1]?.[0]).toContain('scripts/db/init-migration-table.ts');
    expect(calls[1]?.[0]).toContain('postgresql://staging-user:staging-pass');
  });

  it('marks initMigrationTable complete and configures DB', async () => {
    await setupPlanetScale('inixiative');

    expect(mockSetProgressComplete).toHaveBeenCalledWith('planetscale', 'initMigrationTable');
    expect(mockUpdateDatabaseSettings).toHaveBeenCalledWith('inixiative', 'template', {
      allow_foreign_key_constraints: true,
    });
  });
});
