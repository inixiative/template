/**
 * Test: TokenInputView logic
 *
 * Tests the token collection and Infisical storage flow
 * without rendering the React component (no ink-testing-library needed).
 * Uses VCR fixtures — run with real credentials to record.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { infisicalApi } from '../../api/infisical';

describe('TokenInputView - setSecretAsync via VCR', () => {
  beforeEach(() => {
    infisicalApi.vcr.clear();
  });

  afterEach(() => {
    infisicalApi.vcr.clear();
  });

  test('setSecretAsync stores tokens in Infisical', async () => {
    infisicalApi.vcr.queue('setSecret', 'tokenId');
    infisicalApi.vcr.queue('setSecret', 'token');

    const { setSecretAsync } = await import('../../tasks/infisicalSetup');

    await setSecretAsync('proj-123', 'root', 'PLANETSCALE_TOKEN_ID', 'pscale_tkid_test123');
    await setSecretAsync('proj-123', 'root', 'PLANETSCALE_TOKEN', 'pscale_tk_secret456');

    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  });

  test('setSecretAsync propagates VCR errors', async () => {
    // Queue an error fixture (status >= 400 → throws)
    infisicalApi.vcr.queue('setSecret', 'error');

    const { setSecretAsync } = await import('../../tasks/infisicalSetup');

    await expect(setSecretAsync('proj-123', 'root', 'PLANETSCALE_TOKEN', 'value')).rejects.toThrow();
  });

  test('multiple token fields are stored independently', async () => {
    infisicalApi.vcr.queue('setSecret', 'org');
    infisicalApi.vcr.queue('setSecret', 'region');
    infisicalApi.vcr.queue('setSecret', 'tokenId');
    infisicalApi.vcr.queue('setSecret', 'token');

    const { setSecretAsync } = await import('../../tasks/infisicalSetup');

    const tokens = [
      { key: 'PLANETSCALE_ORGANIZATION', env: 'root', value: 'test-org' },
      { key: 'PLANETSCALE_REGION', env: 'root', value: 'us-east' },
      { key: 'PLANETSCALE_TOKEN_ID', env: 'root', value: 'pscale_tkid_abc' },
      { key: 'PLANETSCALE_TOKEN', env: 'root', value: 'pscale_tk_xyz' },
    ];

    for (const t of tokens) {
      await setSecretAsync('proj-123', t.env, t.key, t.value);
    }

    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  });
});

describe('TokenInputView - getSecretAsync via VCR', () => {
  beforeEach(() => {
    infisicalApi.vcr.clear();
  });

  afterEach(() => {
    infisicalApi.vcr.clear();
  });

  test('getSecretAsync returns values from VCR fixtures', async () => {
    infisicalApi.vcr.queue('getSecret', 'planetscaleTokenId');
    infisicalApi.vcr.queue('getSecret', 'planetscaleToken');

    const { getSecretAsync } = await import('../../tasks/infisicalSetup');

    const tokenId = await getSecretAsync('PLANETSCALE_TOKEN_ID', { projectId: 'proj-123', environment: 'root' });
    const token = await getSecretAsync('PLANETSCALE_TOKEN', { projectId: 'proj-123', environment: 'root' });

    expect(tokenId).toEqual(expect.any(String));
    expect(token).toEqual(expect.any(String));
    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  });
});
