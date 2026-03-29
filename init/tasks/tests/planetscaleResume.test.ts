/**
 * Test: PlanetScale setup resume scenario
 *
 * Verifies that when resuming with passwords already created:
 * 1. Doesn't try to create new roles (would cause "Display name already taken")
 * 2. Fetches connection strings from Infisical
 * 3. Successfully runs initMigrationTable step
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { planetscaleApi } from '../../api/planetscale';
import { createMockConfig, createMockInfisical, createMockSystem } from '../../tests/mocks';

// Create service mocks
const infisical = createMockInfisical();
const config = createMockConfig();
const system = createMockSystem();

// Install all mocks (must be before importing setup code)
infisical.install();
config.install();
system.install();

describe('PlanetScale Resume Scenario', () => {
  beforeEach(() => {
    planetscaleApi.vcr.clear();
    infisical.clearAll();
    config.clearAll();
    system.clearAll();
    system.stubExec('bun --cwd packages/db scripts/initMigrationTable.ts', { stdout: '', stderr: '' });

    // Resume scenario: provider-side setup is complete up to per-environment connection strings
    config.markComplete('planetscale', [
      'selectOrg',
      'selectRegion',
      'recordTokenId',
      'storeOrganizationSecret',
      'storeRegionSecret',
      'storeTokenIdSecret',
      'storeTokenSecret',
      'createDB',
      'renameProductionBranch',
      'createStagingBranch',
      'createProdRole',
      'createStagingRole',
      'storeProdConnectionString',
      'storeStagingConnectionString',
    ]);

    // Seed connection strings (already in Infisical from previous run)
    infisical.seed([
      {
        key: 'DATABASE_URL',
        environment: 'prod',
        path: '/api',
        value: 'postgresql://prod-user:prod-pass@aws.connect.psdb.cloud/template?sslmode=require',
      },
      {
        key: 'DATABASE_URL',
        environment: 'staging',
        path: '/api',
        value: 'postgresql://staging-user:staging-pass@aws.connect.psdb.cloud/template?sslmode=require',
      },
    ]);

    // createDB complete → else branch: fetch existing DB
    planetscaleApi.vcr.queue('getDatabase', 'success');
    // createStagingBranch complete → else branch: fetch existing branch
    planetscaleApi.vcr.queue('getBranch', 'staging');
    // configureDB not complete → update settings
    planetscaleApi.vcr.queue('updateDatabaseSettings', 'configureDB');
  });

  afterEach(() => {
    planetscaleApi.vcr.clear();
    infisical.clearAll();
    config.clearAll();
    system.clearAll();
  });

  test('should NOT create new roles when resuming', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');
  });

  test('should fetch connection strings from Infisical', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(infisical.mocks.getSecretAsync).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'infisical-proj-id-000',
      environment: 'prod',
      path: '/api',
    });

    expect(infisical.mocks.getSecretAsync).toHaveBeenCalledWith('DATABASE_URL', {
      projectId: 'infisical-proj-id-000',
      environment: 'staging',
      path: '/api',
    });
  });

  test('should run bun script to init migration table', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    const calls = system.mocks.exec.mock.calls;
    const migrationCalls = calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('initMigrationTable'),
    );
    expect(migrationCalls).toHaveLength(2);

    expect(migrationCalls[0][0]).toContain('postgresql://prod-user:prod-pass');
    expect(migrationCalls[1][0]).toContain('postgresql://staging-user:staging-pass');
  });

  test('should mark both migration table steps as complete', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(config.mocks.markComplete).toHaveBeenCalledWith('planetscale', 'initProdMigrationTable');
    expect(config.mocks.markComplete).toHaveBeenCalledWith('planetscale', 'initStagingMigrationTable');
  });

  test('should configure database after migration table init', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(config.mocks.markComplete).toHaveBeenCalledWith('planetscale', 'configureDB');
  });
});
