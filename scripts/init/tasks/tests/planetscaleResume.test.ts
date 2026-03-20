/**
 * Test: PlanetScale setup resume scenario
 *
 * Verifies that when resuming with passwords already created:
 * 1. Doesn't try to create new passwords (would cause "Display name already taken")
 * 2. Fetches connection strings from Infisical
 * 3. Successfully runs initMigrationTable step
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock modules MUST be at top level before imports
vi.mock('../../utils/configHelpers');
vi.mock('../infisicalSetup');
vi.mock('../../api/planetscale');
vi.mock('node:child_process');
vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>();
  return {
    ...actual,
    promisify: (fn: unknown) => {
      // Return an async wrapper that calls the mock
      return async (...args: unknown[]) => {
        const result = (fn as (...a: unknown[]) => unknown)(...args);
        return { stdout: result || '', stderr: '' };
      };
    },
  };
});

import { exec } from 'node:child_process';
import type { PlanetScaleBranch, PlanetScaleDatabase } from '../../api/planetscale';
import * as planetscaleApi from '../../api/planetscale';
import * as configHelpers from '../../utils/configHelpers';
import type { ProjectConfig } from '../../utils/getProjectConfig';
import * as infisicalSetup from '../infisicalSetup';

describe('PlanetScale Resume Scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock config state: passwords and connection strings already complete
    vi.mocked(configHelpers.isProgressComplete).mockImplementation(async (section, action) => {
      if (section === 'planetscale') {
        // Steps 1-8 are complete, step 9+ are not
        const completedSteps = [
          'selectOrg',
          'selectRegion',
          'createToken',
          'setInfisicalToken',
          'createDB',
          'setupProductionBranch',
          'createStagingBranch',
          'createPasswords',
          'storeConnectionStrings',
        ];
        return completedSteps.includes(action as string);
      }
      return false;
    });

    // Mock getProjectConfig to return proper config
    vi.mocked(configHelpers.getProjectConfig).mockResolvedValue({
      project: { name: 'template', organization: 'test-org' },
      infisical: { projectId: 'test-project-id' },
      planetscale: {
        organization: 'inixiative',
        database: 'template',
        region: 'us-east',
        tokenId: 'test-token-id',
      },
    } as unknown as ProjectConfig);

    // Mock Infisical getSecretAsync to return connection strings
    vi.mocked(infisicalSetup.getSecretAsync).mockImplementation(
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

    // Mock exec (for bun scripts/db/initMigrationTable.ts)
    vi.mocked(exec).mockImplementation((_cmd: string, _opts: unknown, callback?: unknown) => {
      if (typeof callback === 'function') {
        callback(null, { stdout: '', stderr: '' });
      }
      return {} as ReturnType<typeof exec>;
    });

    // Mock other config helpers
    vi.mocked(configHelpers.setProgressComplete).mockResolvedValue(undefined);
    vi.mocked(configHelpers.updateConfigField).mockResolvedValue(undefined);
    vi.mocked(configHelpers.clearConfigError).mockResolvedValue(undefined);

    // Mock PlanetScale API calls
    vi.mocked(planetscaleApi.getDatabase).mockResolvedValue({
      id: 'db-id',
      name: 'template',
      region: 'us-east',
    } as unknown as PlanetScaleDatabase);

    vi.mocked(planetscaleApi.getBranch).mockResolvedValue({
      id: 'branch-id',
      name: 'main',
      region: 'us-east',
      production: true,
    } as unknown as PlanetScaleBranch);

    vi.mocked(planetscaleApi.updateDatabaseSettings).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should NOT create new passwords when resuming', async () => {
    // Import after mocks are set up
    const { setupPlanetScale } = await import('../planetscaleSetup');

    // Run setup
    await setupPlanetScale('inixiative');

    // Verify createPassword was NEVER called
    expect(planetscaleApi.createPassword).not.toHaveBeenCalled();
  });

  test('should fetch connection strings from Infisical', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    // Verify getSecretAsync was called for both environments
    expect(infisicalSetup.getSecretAsync).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'test-project-id',
      environment: 'prod',
      path: '/api',
    });

    expect(infisicalSetup.getSecretAsync).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'test-project-id',
      environment: 'staging',
      path: '/api',
    });
  });

  test('should run bun script to init migration table', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    // Verify exec was called for both prod and staging migration tables
    const calls = vi.mocked(exec).mock.calls;
    const migrationCalls = calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('initMigrationTable'),
    );
    expect(migrationCalls).toHaveLength(2);

    // Check it called with correct connection strings
    expect(migrationCalls[0][0]).toContain('postgresql://prod-user:prod-pass');
    expect(migrationCalls[1][0]).toContain('postgresql://staging-user:staging-pass');
  });

  test('should mark initMigrationTable as complete', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    // Verify progress was marked complete
    expect(configHelpers.setProgressComplete).toHaveBeenCalledWith('planetscale', 'initMigrationTable');
  });

  test('should configure database after migration table init', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');

    await setupPlanetScale('inixiative');

    // Verify database settings were updated
    expect(planetscaleApi.updateDatabaseSettings).toHaveBeenCalledWith('inixiative', 'template', {
      allow_foreign_key_constraints: true,
      automatic_migrations: true,
      migration_table_name: '_prisma_migrations',
    });
  });
});
