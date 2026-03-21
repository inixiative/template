/**
 * Test: PlanetScale setup resume scenario
 *
 * Verifies that when resuming with passwords already created:
 * 1. Doesn't try to create new roles (would cause "Display name already taken")
 * 2. Fetches connection strings from Infisical
 * 3. Successfully runs initMigrationTable step
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PlanetScaleBranch, PlanetScaleDatabase } from '../../api/planetscale';
import {
  createMockConfig,
  createMockInfisical,
  createMockPlanetScale,
  createMockSystem,
  loadFixture,
} from '../../tests/mocks';

// Create service mocks
const ps = createMockPlanetScale();
const infisical = createMockInfisical();
const config = createMockConfig();
const system = createMockSystem();

// Install all mocks (must be before importing setup code)
ps.install();
infisical.install();
config.install();
system.install();

describe('PlanetScale Resume Scenario', () => {
  beforeEach(() => {
    ps.clearAll();
    infisical.clearAll();
    config.clearAll();
    system.clearAll();

    // Resume scenario: steps 1-9 are complete
    config.markComplete('planetscale', [
      'selectOrg',
      'selectRegion',
      'createToken',
      'setInfisicalToken',
      'createDB',
      'renameProductionBranch',
      'createStagingBranch',
      'createPasswords',
      'storeConnectionStrings',
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

    // VCR: getDatabase called once (resume fetches existing DB)
    ps.vcr.database.add(loadFixture<PlanetScaleDatabase>('planetscale/createDatabase'));

    // VCR: getBranch called for staging (resume fetches existing branch)
    ps.vcr.branch.add(loadFixture<PlanetScaleBranch>('planetscale/getBranch-staging'));
  });

  afterEach(() => {
    ps.clearAll();
    infisical.clearAll();
    config.clearAll();
    system.clearAll();
  });

  test('should NOT create new roles when resuming', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(ps.mocks.createRole).not.toHaveBeenCalled();
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

  test('should mark initMigrationTable as complete', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('planetscale', 'initMigrationTable');
  });

  test('should configure database after migration table init', async () => {
    const { setupPlanetScale } = await import('../planetscaleSetup');
    await setupPlanetScale('test-org');

    expect(ps.mocks.updateDatabaseSettings).toHaveBeenCalledWith('test-org', 'template', {
      allow_foreign_key_constraints: true,
    });
  });
});
