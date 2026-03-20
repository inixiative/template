/**
 * Test: TokenInputView logic
 *
 * Tests the token collection and Infisical storage flow
 * without rendering the React component (no ink-testing-library needed).
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createMockInfisical, createMockSystem } from '../../tests/mocks';

const infisical = createMockInfisical();
const system = createMockSystem();

infisical.install();
system.install();

describe('TokenInputView - setSecretAsync integration', () => {
  beforeEach(() => {
    infisical.clearAll();
    system.clearAll();
  });

  afterEach(() => {
    infisical.clearAll();
  });

  test('setSecretAsync stores tokens in Infisical', async () => {
    const { setSecretAsync } = await import('../../tasks/infisicalSetup');

    await setSecretAsync('proj-123', 'root', 'PLANETSCALE_TOKEN_ID', 'pscale_tkid_test123');
    await setSecretAsync('proj-123', 'root', 'PLANETSCALE_TOKEN', 'pscale_tk_secret456');

    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledTimes(2);
    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledWith(
      'proj-123', 'root', 'PLANETSCALE_TOKEN_ID', 'pscale_tkid_test123',
    );
    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledWith(
      'proj-123', 'root', 'PLANETSCALE_TOKEN', 'pscale_tk_secret456',
    );

    // Verify stored in mock store
    expect(infisical.secretStore.get('PLANETSCALE_TOKEN_ID')).toBe('pscale_tkid_test123');
    expect(infisical.secretStore.get('PLANETSCALE_TOKEN')).toBe('pscale_tk_secret456');
  });

  test('setSecretAsync propagates errors', async () => {
    const { setSecretAsync } = await import('../../tasks/infisicalSetup');

    // Override to simulate failure
    infisical.mocks.setSecretAsync.mockRejectedValueOnce(
      new Error('Failed to set secret PLANETSCALE_TOKEN: Connection refused'),
    );

    await expect(
      setSecretAsync('proj-123', 'root', 'PLANETSCALE_TOKEN', 'value'),
    ).rejects.toThrow('Connection refused');
  });

  test('multiple token fields are stored independently', async () => {
    const { setSecretAsync } = await import('../../tasks/infisicalSetup');

    // Simulate what TokenInputView does: save all tokens on final submit
    const tokens = [
      { key: 'PLANETSCALE_ORGANIZATION', env: 'root', value: 'test-org' },
      { key: 'PLANETSCALE_REGION', env: 'root', value: 'us-east' },
      { key: 'PLANETSCALE_TOKEN_ID', env: 'root', value: 'pscale_tkid_abc' },
      { key: 'PLANETSCALE_TOKEN', env: 'root', value: 'pscale_tk_xyz' },
    ];

    for (const t of tokens) {
      await setSecretAsync('proj-123', t.env, t.key, t.value);
    }

    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledTimes(4);
    expect(infisical.secretStore.get('PLANETSCALE_ORGANIZATION')).toBe('test-org');
    expect(infisical.secretStore.get('PLANETSCALE_REGION')).toBe('us-east');
    expect(infisical.secretStore.get('PLANETSCALE_TOKEN_ID')).toBe('pscale_tkid_abc');
    expect(infisical.secretStore.get('PLANETSCALE_TOKEN')).toBe('pscale_tk_xyz');
  });
});

describe('TokenInputView - VCR error injection', () => {
  beforeEach(() => {
    infisical.clearAll();
    system.clearAll();
  });

  test('getSecretAsync returns VCR values when loaded', async () => {
    const { getSecretAsync } = await import('../../tasks/infisicalSetup');

    // Load VCR with specific responses
    infisical.vcr.getSecret.add('pscale_tkid_from_vcr');
    infisical.vcr.getSecret.add('pscale_tk_from_vcr');

    const tokenId = await getSecretAsync('PLANETSCALE_TOKEN_ID', { projectId: 'proj-123', environment: 'root' });
    const token = await getSecretAsync('PLANETSCALE_TOKEN', { projectId: 'proj-123', environment: 'root' });

    expect(tokenId).toBe('pscale_tkid_from_vcr');
    expect(token).toBe('pscale_tk_from_vcr');
  });

  test('getSecretAsync falls back to secret store when VCR empty', async () => {
    const { getSecretAsync } = await import('../../tasks/infisicalSetup');

    infisical.seed([
      { key: 'MY_TOKEN', value: 'stored-value' },
    ]);

    const value = await getSecretAsync('MY_TOKEN', { projectId: 'proj-123', environment: 'root' });
    expect(value).toBe('stored-value');
  });
});
