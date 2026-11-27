import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import * as infisical from '../infisical';
import { infisicalVercelApi } from '../infisicalVercel';

afterEach(() => mock.restore());

const input = {
  infisicalProjectId: 'source',
  connectionId: 'connection',
  syncName: 'app-prod-web',
  infisicalEnvironment: 'prod',
  infisicalSecretPath: '/web',
  vercelProjectId: 'project',
  vercelProjectName: 'app-web',
  vercelEnvironment: 'production' as const,
  vercelTeamId: 'team',
};

const stubInfisical = (response: unknown) => {
  spyOn(infisical, 'fetchInfisicalTokenOrThrow').mockResolvedValue('synthetic-token');
  spyOn(infisicalVercelApi.vcr, 'capture').mockImplementation(async (_operation, run) => run());
  return spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(response));
};

test('a new Vercel sync never deletes variables Infisical does not hold', async () => {
  const request = stubInfisical({ secretSync: { id: 'sync' } });
  await infisicalVercelApi.createVercelSync(
    input.infisicalProjectId,
    input.connectionId,
    input.syncName,
    input.infisicalEnvironment,
    input.infisicalSecretPath,
    input.vercelProjectId,
    input.vercelProjectName,
    input.vercelEnvironment,
    input.vercelTeamId,
  );
  const body = JSON.parse(request.mock.calls[0]?.[1]?.body as string);
  expect(body.syncOptions.disableSecretDeletion).toBe(true);
});

test('an existing Vercel sync is accepted only with deletion off', async () => {
  const existing = { id: 'sync', name: input.syncName };
  stubInfisical({ secretSyncs: [{ ...existing, syncOptions: { disableSecretDeletion: true } }] });
  await infisicalVercelApi.ensureVercelSync(input);

  mock.restore();
  stubInfisical({ secretSyncs: [existing] });
  await expect(infisicalVercelApi.ensureVercelSync(input)).rejects.toThrow(
    'Disable Secret Deletion',
  );
});

test('a drifted Vercel sync is replaced without first asking for a manual fix', async () => {
  const drifted = { id: 'sync', name: input.syncName, destinationConfig: { branch: 'old' } };
  const request = stubInfisical({});
  request.mockImplementation((async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json({ secretSync: { id: 'replacement' } });
    return Response.json({ secretSyncs: [drifted] });
  }) as typeof fetch);
  await infisicalVercelApi.ensureVercelSync(input);
  expect(request.mock.calls.map((call) => call[1]?.method ?? 'GET')).toEqual([
    'GET',
    'DELETE',
    'POST',
  ]);
});
