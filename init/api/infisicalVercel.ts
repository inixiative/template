import { join } from 'node:path';
import { VCR } from '../../packages/shared/src/vcr';
import { getInfisicalToken } from './infisical';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/infisicalVercel');

type VercelSecretSync = {
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
    environment?: string;
  };
};

type EnsureVercelSyncInput = {
  infisicalProjectId: string;
  connectionId: string;
  syncName: string;
  infisicalEnvironment: string;
  infisicalSecretPath: string;
  vercelProjectId: string;
  vercelProjectName: string;
  vercelEnvironment: 'production' | 'preview' | 'development';
  vercelTeamId: string;
  vercelBranch?: string;
};

class InfisicalVercelApi {
  readonly vcr = new VCR(FIXTURES_DIR);

  async listVercelConnections(infisicalProjectId: string): Promise<Array<{ id: string; name: string }>> {
    if (process.env.NODE_ENV !== 'test') return this._listVercelConnections(infisicalProjectId);
    return this.vcr.capture('listVercelConnections', () => this._listVercelConnections(infisicalProjectId));
  }
  private async _listVercelConnections(infisicalProjectId: string): Promise<Array<{ id: string; name: string }>> {
    const infisicalToken = await getInfisicalToken();
    const response = await fetch(
      `https://app.infisical.com/api/v1/app-connections/vercel?projectId=${infisicalProjectId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${infisicalToken}` },
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Vercel connections: ${response.statusText}\n${errorText}`);
    }
    const data = (await response.json()) as { appConnections?: Array<{ id: string; name: string }> };
    return data.appConnections ?? [];
  }

  async listVercelSyncs(infisicalProjectId: string): Promise<VercelSecretSync[]> {
    if (process.env.NODE_ENV !== 'test') return this._listVercelSyncs(infisicalProjectId);
    return this.vcr.capture('listVercelSyncs', () => this._listVercelSyncs(infisicalProjectId));
  }
  private async _listVercelSyncs(infisicalProjectId: string): Promise<VercelSecretSync[]> {
    const infisicalToken = await getInfisicalToken();
    const response = await fetch(
      `https://app.infisical.com/api/v1/secret-syncs/vercel?projectId=${infisicalProjectId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${infisicalToken}` },
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Vercel syncs: ${response.statusText}\n${errorText}`);
    }
    const data = (await response.json()) as { secretSyncs?: VercelSecretSync[] };
    return data.secretSyncs ?? [];
  }

  async createVercelConnection(
    infisicalProjectId: string,
    vercelApiToken: string,
    connectionName: string,
  ): Promise<string> {
    if (process.env.NODE_ENV !== 'test')
      return this._createVercelConnection(infisicalProjectId, vercelApiToken, connectionName);
    return this.vcr.capture('createVercelConnection', () =>
      this._createVercelConnection(infisicalProjectId, vercelApiToken, connectionName),
    );
  }
  private async _createVercelConnection(
    infisicalProjectId: string,
    vercelApiToken: string,
    connectionName: string,
  ): Promise<string> {
    const infisicalToken = await getInfisicalToken();

    const existingConnections = await this._listVercelConnections(infisicalProjectId);
    const existing = existingConnections.find((conn) => conn.name === connectionName);
    if (existing) return existing.id;

    const response = await fetch('https://app.infisical.com/api/v1/app-connections/vercel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${infisicalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: infisicalProjectId,
        name: connectionName,
        method: 'api-token',
        credentials: { apiToken: vercelApiToken },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Vercel connection: ${response.statusText}\n${errorText}`);
    }

    const data = (await response.json()) as { appConnection?: { id?: string }; id?: string };
    const connectionId = data.appConnection?.id ?? data.id;
    if (!connectionId) throw new Error(`Failed to create Vercel connection "${connectionName}"`);
    return connectionId;
  }

  async createVercelSync(
    infisicalProjectId: string,
    connectionId: string,
    syncName: string,
    infisicalEnvironment: string,
    infisicalSecretPath: string,
    vercelProjectId: string,
    vercelProjectName: string,
    vercelEnvironment: 'production' | 'preview' | 'development',
    vercelTeamId: string,
    vercelBranch?: string,
  ): Promise<string> {
    if (process.env.NODE_ENV !== 'test') {
      return this._createVercelSync(
        infisicalProjectId,
        connectionId,
        syncName,
        infisicalEnvironment,
        infisicalSecretPath,
        vercelProjectId,
        vercelProjectName,
        vercelEnvironment,
        vercelTeamId,
        vercelBranch,
      );
    }
    return this.vcr.capture('createVercelSync', () =>
      this._createVercelSync(
        infisicalProjectId,
        connectionId,
        syncName,
        infisicalEnvironment,
        infisicalSecretPath,
        vercelProjectId,
        vercelProjectName,
        vercelEnvironment,
        vercelTeamId,
        vercelBranch,
      ),
    );
  }
  private async _createVercelSync(
    infisicalProjectId: string,
    connectionId: string,
    syncName: string,
    infisicalEnvironment: string,
    infisicalSecretPath: string,
    vercelProjectId: string,
    vercelProjectName: string,
    vercelEnvironment: 'production' | 'preview' | 'development',
    vercelTeamId: string,
    vercelBranch?: string,
  ): Promise<string> {
    const infisicalToken = await getInfisicalToken();
    const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/vercel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${infisicalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: infisicalProjectId,
        connectionId,
        name: syncName,
        description: `Sync ${infisicalEnvironment} secrets to Vercel ${vercelEnvironment} for ${vercelProjectName}`,
        environment: infisicalEnvironment,
        secretPath: infisicalSecretPath,
        isEnabled: true,
        syncOptions: { initialSyncBehavior: 'overwrite-destination' },
        destinationConfig: {
          app: vercelProjectId,
          appName: vercelProjectName,
          env: vercelEnvironment,
          teamId: vercelTeamId,
          ...(vercelBranch && { branch: vercelBranch }),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Vercel sync: ${response.statusText}\n${errorText}`);
    }

    const data = (await response.json()) as { secretSync?: { id?: string }; id?: string };
    const syncId = data.secretSync?.id ?? data.id;
    if (!syncId) throw new Error(`Failed to create Vercel sync "${syncName}"`);
    return syncId;
  }

  async ensureVercelSync(input: EnsureVercelSyncInput): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._ensureVercelSync(input);
    return this.vcr.capture('ensureVercelSync', () => this._ensureVercelSync(input));
  }
  private async _ensureVercelSync({
    infisicalProjectId,
    connectionId,
    syncName,
    infisicalEnvironment,
    infisicalSecretPath,
    vercelProjectId,
    vercelProjectName,
    vercelEnvironment,
    vercelTeamId,
    vercelBranch,
  }: EnsureVercelSyncInput): Promise<void> {
    const existingSyncs = await this._listVercelSyncs(infisicalProjectId);
    const existing = existingSyncs.find((sync) => sync.name === syncName);
    if (!existing) {
      await this._createVercelSync(
        infisicalProjectId,
        connectionId,
        syncName,
        infisicalEnvironment,
        infisicalSecretPath,
        vercelProjectId,
        vercelProjectName,
        vercelEnvironment,
        vercelTeamId,
        vercelBranch,
      );
    }
  }
}

export const infisicalVercelApi = new InfisicalVercelApi();
