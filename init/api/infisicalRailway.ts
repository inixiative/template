import { join } from 'path';
import { cliVersion, VCR } from '../../packages/shared/src/vcr';
import { getInfisicalToken } from './infisical';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/infisicalRailway');

type RailwaySecretSync = {
  id: string;
  name: string;
  environment?: { slug?: string };
  folder?: { path?: string };
  destinationConfig?: {
    projectId?: string;
    projectName?: string;
    environmentId?: string;
    environmentName?: string;
    serviceId?: string;
    serviceName?: string;
  };
};

type EnsureRailwaySyncInput = {
  infisicalProjectId: string;
  connectionId: string;
  syncName: string;
  infisicalEnvironment: string;
  infisicalSecretPath: string;
  railwayProjectId: string;
  railwayProjectName: string;
  railwayEnvironmentId: string;
  railwayEnvironmentName: string;
  railwayServiceId: string;
  railwayServiceName: string;
};

class InfisicalRailwayApi {
  readonly vcr = new VCR(FIXTURES_DIR, {
    service: 'infisical|railway',
    // Composite: either CLI bumping should invalidate cassettes since
    // both shape the Infisical-Railway connection payload.
    version: async () => (await Promise.all([cliVersion('infisical'), cliVersion('railway')])).join('|'),
    sanitizers: {
      createRailwayConnection: { fn: () => 'REDACTED' },
    },
  });

  async listRailwayConnections(infisicalProjectId: string): Promise<Array<{ id: string; name: string }>> {
    return this.vcr.capture('listRailwayConnections', async () => {
      const infisicalToken = await getInfisicalToken();
      const response = await fetch(
        `https://app.infisical.com/api/v1/app-connections/railway?projectId=${infisicalProjectId}`,
        { method: 'GET', headers: { Authorization: `Bearer ${infisicalToken}` } },
      );
      if (!response.ok) {
        throw new Error(`Failed to list Railway connections: ${response.statusText}\n${await response.text()}`);
      }
      const data = (await response.json()) as { appConnections?: Array<{ id: string; name: string }> };
      return data.appConnections ?? [];
    });
  }

  async listRailwaySyncs(infisicalProjectId: string): Promise<RailwaySecretSync[]> {
    return this.vcr.capture('listRailwaySyncs', async () => {
      const infisicalToken = await getInfisicalToken();
      const response = await fetch(
        `https://app.infisical.com/api/v1/secret-syncs/railway?projectId=${infisicalProjectId}`,
        { method: 'GET', headers: { Authorization: `Bearer ${infisicalToken}` } },
      );
      if (!response.ok) {
        throw new Error(`Failed to list Railway syncs: ${response.statusText}\n${await response.text()}`);
      }
      const data = (await response.json()) as { secretSyncs?: RailwaySecretSync[] };
      return data.secretSyncs ?? [];
    });
  }

  async createRailwayConnection(
    infisicalProjectId: string,
    railwayApiToken: string,
    connectionName: string,
  ): Promise<string> {
    return this.vcr.capture('createRailwayConnection', async () => {
      const infisicalToken = await getInfisicalToken();
      const response = await fetch('https://app.infisical.com/api/v1/app-connections/railway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${infisicalToken}` },
        body: JSON.stringify({
          name: connectionName,
          method: 'team-token',
          projectId: infisicalProjectId,
          credentials: { apiToken: railwayApiToken },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('already exists')) {
          const existing = (await this.listRailwayConnections(infisicalProjectId)).find(
            (c) => c.name === connectionName,
          );
          if (existing) return existing.id;
        }
        throw new Error(`Failed to create Railway connection in Infisical: ${response.statusText}\n${errorText}`);
      }

      const data = (await response.json()) as { appConnection?: { id?: string } };
      if (!data.appConnection?.id) throw new Error(`Unexpected Infisical API response: ${JSON.stringify(data)}`);
      return data.appConnection.id;
    });
  }

  async createRailwaySync(input: EnsureRailwaySyncInput): Promise<void> {
    return this.vcr.capture('createRailwaySync', async () => {
      const infisicalToken = await getInfisicalToken();
      const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/railway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${infisicalToken}` },
        body: JSON.stringify({
          name: input.syncName,
          projectId: input.infisicalProjectId,
          environment: input.infisicalEnvironment,
          secretPath: input.infisicalSecretPath,
          connectionId: input.connectionId,
          syncOptions: { initialSyncBehavior: 'import-prioritize-source' },
          destinationConfig: {
            projectId: input.railwayProjectId,
            projectName: input.railwayProjectName,
            environmentId: input.railwayEnvironmentId,
            environmentName: input.railwayEnvironmentName,
            serviceId: input.railwayServiceId,
            serviceName: input.railwayServiceName,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create Railway sync "${input.syncName}": ${response.statusText}\n${await response.text()}`,
        );
      }
    });
  }

  async ensureRailwaySync(input: EnsureRailwaySyncInput): Promise<void> {
    return this.vcr.capture('ensureRailwaySync', async () => {
      const existing = (await this.listRailwaySyncs(input.infisicalProjectId)).find((s) => s.name === input.syncName);
      if (!existing) {
        await this.createRailwaySync(input);
        return;
      }

      const mismatches: string[] = [];
      if ((existing.environment?.slug || '') !== input.infisicalEnvironment) {
        mismatches.push(
          `environment: expected "${input.infisicalEnvironment}", got "${existing.environment?.slug || ''}"`,
        );
      }
      if ((existing.folder?.path || '') !== input.infisicalSecretPath) {
        mismatches.push(`secretPath: expected "${input.infisicalSecretPath}", got "${existing.folder?.path || ''}"`);
      }

      const destinationConfig = existing.destinationConfig || {};
      if ((destinationConfig.projectId || '') !== input.railwayProjectId) {
        mismatches.push(`projectId: expected "${input.railwayProjectId}", got "${destinationConfig.projectId || ''}"`);
      }
      if ((destinationConfig.environmentId || '') !== input.railwayEnvironmentId) {
        mismatches.push(
          `environmentId: expected "${input.railwayEnvironmentId}", got "${destinationConfig.environmentId || ''}"`,
        );
      }
      if ((destinationConfig.serviceId || '') !== input.railwayServiceId) {
        mismatches.push(`serviceId: expected "${input.railwayServiceId}", got "${destinationConfig.serviceId || ''}"`);
      }

      if (mismatches.length > 0) {
        throw new Error(
          `Railway sync "${input.syncName}" exists with mismatched config:\n` +
            mismatches.map((m) => `  - ${m}`).join('\n'),
        );
      }
    });
  }
}

export const infisicalRailwayApi = new InfisicalRailwayApi();
