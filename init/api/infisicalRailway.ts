import { join } from 'path';
import { VCR } from '../../packages/shared/src/vcr';
import { getInfisicalToken } from './infisical';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/infisicalRailway');

type RailwaySecretSync = {
  id: string;
  name: string;
  environment?: {
    slug?: string;
  };
  folder?: {
    path?: string;
  };
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
    createRailwayConnection: { fn: () => 'REDACTED' },
  });

  /**
   * Create a Railway connection in Infisical (idempotent - returns existing if already created)
   */
  async createRailwayConnection(
    infisicalProjectId: string,
    railwayApiToken: string,
    connectionName: string,
  ): Promise<string> {
    if (process.env.NODE_ENV !== 'test')
      return this._createRailwayConnection(infisicalProjectId, railwayApiToken, connectionName);
    return this.vcr.capture('createRailwayConnection', () =>
      this._createRailwayConnection(infisicalProjectId, railwayApiToken, connectionName),
    );
  }
  private async _createRailwayConnection(
    infisicalProjectId: string,
    railwayApiToken: string,
    connectionName: string,
  ): Promise<string> {
    const infisicalToken = await getInfisicalToken();

    const response = await fetch('https://app.infisical.com/api/v1/app-connections/railway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${infisicalToken}`,
      },
      body: JSON.stringify({
        name: connectionName,
        method: 'team-token',
        projectId: infisicalProjectId,
        credentials: {
          apiToken: railwayApiToken,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (errorText.includes('already exists')) {
        const connections = await this._listRailwayConnections(infisicalProjectId);
        const existing = connections.find((conn) => conn.name === connectionName);
        if (existing) {
          return existing.id;
        }
      }

      throw new Error(`Failed to create Railway connection in Infisical: ${response.statusText}\n${errorText}`);
    }

    const data = (await response.json()) as { appConnection?: { id?: string } };

    if (data.appConnection?.id) {
      return data.appConnection.id;
    } else {
      throw new Error(`Unexpected Infisical API response: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Ensure a service-scoped Railway sync exists and matches expected config
   */
  async ensureRailwaySync(input: EnsureRailwaySyncInput): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._ensureRailwaySync(input);
    return this.vcr.capture('ensureRailwaySync', () => this._ensureRailwaySync(input));
  }
  private async _ensureRailwaySync(input: EnsureRailwaySyncInput): Promise<void> {
    const existingSyncs = await this._listRailwaySyncs(input.infisicalProjectId);
    const existing = existingSyncs.find((sync) => sync.name === input.syncName);

    if (!existing) {
      await this._createRailwaySync(input);
      return;
    }

    const mismatches: string[] = [];
    if ((existing.environment?.slug || '') !== input.infisicalEnvironment) {
      mismatches.push(
        `environment: expected "${input.infisicalEnvironment}", got "${existing.environment?.slug || ''}"`,
      );
    }
    if ((existing.folder?.path || '') !== input.infisicalSecretPath) {
      mismatches.push(
        `secretPath: expected "${input.infisicalSecretPath}", got "${existing.folder?.path || ''}"`,
      );
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
          mismatches.map((mismatch) => `  - ${mismatch}`).join('\n'),
      );
    }
  }

  /**
   * List Railway secret syncs in Infisical for a project
   */
  async listRailwaySyncs(infisicalProjectId: string): Promise<RailwaySecretSync[]> {
    if (process.env.NODE_ENV !== 'test') return this._listRailwaySyncs(infisicalProjectId);
    return this.vcr.capture('listRailwaySyncs', () => this._listRailwaySyncs(infisicalProjectId));
  }
  private async _listRailwaySyncs(infisicalProjectId: string): Promise<RailwaySecretSync[]> {
    const infisicalToken = await getInfisicalToken();

    const response = await fetch(
      `https://app.infisical.com/api/v1/secret-syncs/railway?projectId=${infisicalProjectId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${infisicalToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Railway syncs: ${response.statusText}\n${errorText}`);
    }

    const data = (await response.json()) as { secretSyncs?: RailwaySecretSync[] };
    return data.secretSyncs ?? [];
  }

  private async _listRailwayConnections(
    infisicalProjectId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const infisicalToken = await getInfisicalToken();

    const response = await fetch(
      `https://app.infisical.com/api/v1/app-connections/railway?projectId=${infisicalProjectId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${infisicalToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Railway connections: ${response.statusText}\n${errorText}`);
    }

    const data = (await response.json()) as { appConnections?: Array<{ id: string; name: string }> };
    return data.appConnections ?? [];
  }

  private async _createRailwaySync(input: EnsureRailwaySyncInput): Promise<void> {
    const infisicalToken = await getInfisicalToken();

    const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/railway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${infisicalToken}`,
      },
      body: JSON.stringify({
        name: input.syncName,
        projectId: input.infisicalProjectId,
        environment: input.infisicalEnvironment,
        secretPath: input.infisicalSecretPath,
        connectionId: input.connectionId,
        syncOptions: {
          initialSyncBehavior: 'import-prioritize-source',
        },
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
      const errorText = await response.text();
      throw new Error(`Failed to create Railway sync "${input.syncName}": ${response.statusText}\n${errorText}`);
    }
  }
}

export const infisicalRailwayApi = new InfisicalRailwayApi();
