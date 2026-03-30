/**
 * Test: TokenInputView logic
 *
 * Tests the token collection and Infisical storage flow
 * without rendering the React component (no ink-testing-library needed).
 * Uses VCR fixtures — run with real credentials to record.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { infisicalApi } from '../../api/infisical';

const liveProjectId = process.env.INFISICAL_PROJECT_ID ?? 'proj-123';
const liveTokenId = process.env.PLANETSCALE_TOKEN_ID ?? 'pscale_tkid_test123';
const liveToken = process.env.PLANETSCALE_TOKEN ?? 'pscale_tk_secret456';
const liveOrg = process.env.PLANETSCALE_ORG ?? 'test-org';
const liveRegion = process.env.PLANETSCALE_REGION ?? 'us-east';

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

    // Cache-bust to avoid mock.module pollution from other test files
    const { setSecretAsync } = await import(`../../tasks/infisicalSetup?v=${Date.now()}`);

    await setSecretAsync(liveProjectId, 'root', 'PLANETSCALE_TOKEN_ID', liveTokenId);
    await setSecretAsync(liveProjectId, 'root', 'PLANETSCALE_TOKEN', liveToken);

    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  }, 60_000);

  test('multiple token fields are stored independently', async () => {
    infisicalApi.vcr.queue('setSecret', 'org');
    infisicalApi.vcr.queue('setSecret', 'region');
    infisicalApi.vcr.queue('setSecret', 'tokenId');
    infisicalApi.vcr.queue('setSecret', 'token');

    const { setSecretAsync } = await import(`../../tasks/infisicalSetup?v=${Date.now()}`);

    const tokens = [
      { key: 'PLANETSCALE_ORGANIZATION', env: 'root', value: liveOrg },
      { key: 'PLANETSCALE_REGION', env: 'root', value: liveRegion },
      { key: 'PLANETSCALE_TOKEN_ID', env: 'root', value: liveTokenId },
      { key: 'PLANETSCALE_TOKEN', env: 'root', value: liveToken },
    ];

    for (const t of tokens) {
      await setSecretAsync(liveProjectId, t.env, t.key, t.value);
    }

    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  }, 60_000);
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

    const { getSecretAsync } = await import(`../../tasks/infisicalSetup?v=${Date.now()}`);

    const tokenId = await getSecretAsync('PLANETSCALE_TOKEN_ID', { projectId: liveProjectId, environment: 'root' });
    const token = await getSecretAsync('PLANETSCALE_TOKEN', { projectId: liveProjectId, environment: 'root' });

    expect(tokenId).toEqual(expect.any(String));
    expect(token).toEqual(expect.any(String));
    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  }, 60_000);
});
