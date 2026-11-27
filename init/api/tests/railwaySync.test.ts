import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import * as infisical from '../infisical';
import { infisicalRailwayApi } from '../infisicalRailway';

afterEach(() => mock.restore());

const input = {
  infisicalProjectId: 'source',
  connectionId: 'connection',
  syncName: 'app-prod-api-service-sync',
  infisicalEnvironment: 'prod',
  infisicalSecretPath: '/api',
  railwayProjectId: 'project',
  railwayProjectName: 'app',
  railwayEnvironmentId: 'environment',
  railwayEnvironmentName: 'production',
  railwayServiceId: 'service',
  railwayServiceName: 'api',
};

const existing = {
  id: 'sync',
  name: input.syncName,
  environment: { slug: input.infisicalEnvironment },
  folder: { path: input.infisicalSecretPath },
  destinationConfig: {
    projectId: input.railwayProjectId,
    environmentId: input.railwayEnvironmentId,
    serviceId: input.railwayServiceId,
  },
};

const stubInfisical = (response: unknown) => {
  spyOn(infisical, 'fetchInfisicalTokenOrThrow').mockResolvedValue('synthetic-token');
  spyOn(infisicalRailwayApi.vcr, 'capture').mockImplementation(async (_operation, run) => run());
  return spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(response));
};

test('a new Railway sync never deletes variables Infisical does not hold', async () => {
  const request = stubInfisical({});
  await infisicalRailwayApi.createRailwaySync(input);
  const body = JSON.parse(request.mock.calls[0]?.[1]?.body as string);
  expect(body.syncOptions.disableSecretDeletion).toBe(true);
});

test('an existing Railway sync is accepted only with deletion off', async () => {
  stubInfisical({
    secretSyncs: [{ ...existing, syncOptions: { disableSecretDeletion: true } }],
  });
  await infisicalRailwayApi.ensureRailwaySync(input);

  mock.restore();
  stubInfisical({ secretSyncs: [existing] });
  await expect(infisicalRailwayApi.ensureRailwaySync(input)).rejects.toThrow(
    'disableSecretDeletion',
  );
});
