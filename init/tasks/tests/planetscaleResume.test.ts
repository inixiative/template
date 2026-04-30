/**
 * Test: PlanetScale setup resume scenario
 *
 * Verifies that when resuming with passwords already created:
 * 1. Doesn't try to create new roles (would cause "Display name already taken")
 * 2. Fetches connection strings from Infisical
 * 3. Successfully runs initMigrationTable step
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { infisicalApi } from '../../api/infisical';
import { planetscaleApi } from '../../api/planetscale';
import { createMockConfig, createMockSystem } from '../../tests/mocks';

// Create service mocks
const config = createMockConfig();
const system = createMockSystem();

// Install all mocks (must be before importing setup code)
config.install();
system.install();

describe('PlanetScale Resume Scenario', () => {
  beforeEach(() => {
    planetscaleApi.vcr.clear();
    infisicalApi.vcr.clear();
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

    // getSecret VCR fixtures for connection strings (fetched from Infisical):
    // initProdMigrationTable step + final return
    infisicalApi.vcr.queue('getSecret', 'prodDatabaseUrl');
    infisicalApi.vcr.queue('getSecret', 'stagingDatabaseUrl');
    // final return fetches both again
    infisicalApi.vcr.queue('getSecret', 'prodDatabaseUrl');
    infisicalApi.vcr.queue('getSecret', 'stagingDatabaseUrl');

    // createDB complete → else branch: fetch existing DB
    planetscaleApi.vcr.queue('getDatabase', 'success');
    // createStagingBranch complete → else branch: fetch existing branch
    planetscaleApi.vcr.queue('getBranch', 'staging');
  });

  afterEach(() => {
    planetscaleApi.vcr.clear();
    infisicalApi.vcr.clear();
    config.clearAll();
    system.clearAll();
  });

  test('should NOT create new roles when resuming', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');
  }, 60_000);

  test('should fetch connection strings from Infisical and init migration tables', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    // All VCR cassettes consumed — getSecret was called the expected number of times
    expect(infisicalApi.vcr.isEmpty()).toBe(true);

    const calls = system.mocks.exec.mock.calls;
    const migrationCalls = calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('initMigrationTable'),
    );
    expect(migrationCalls).toHaveLength(2);
  }, 60_000);

  test('should mark both migration table steps as complete', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(config.mocks.markComplete).toHaveBeenCalledWith('planetscale', 'initProdMigrationTable');
    expect(config.mocks.markComplete).toHaveBeenCalledWith('planetscale', 'initStagingMigrationTable');
  }, 60_000);

  test('should configure database after migration table init', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(config.mocks.markComplete).toHaveBeenCalledWith('planetscale', 'configureDB');
  }, 60_000);
});
