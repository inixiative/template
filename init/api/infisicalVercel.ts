import { join } from 'node:path';
import { createVcrRecorder, fetchCliVersion } from '@inixiative/vcr';
import { captureInTest } from './capture';
import { fetchInfisicalTokenOrThrow } from './infisical';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/infisicalVercel');

type VercelSecretSync = {
  id: string;
  name: string;
  environment?: { slug?: string };
  folder?: { path?: string };
  destinationConfig?: {
    projectId?: string;
    projectName?: string;
    environment?: string;
    branch?: string;
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
  readonly vcr = createVcrRecorder(FIXTURES_DIR, {
    service: 'infisical|vercel',
    // Composite: either CLI bumping should invalidate cassettes since
    // both shape the Infisical-Vercel connection payload.
    version: async () =>
      (await Promise.all([fetchCliVersion('infisical'), fetchCliVersion('vercel')])).join('|'),
    sanitizers: {
      createVercelConnection: { transform: () => 'MASKED' },
    },
  });

  async listVercelConnections(
    infisicalProjectId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    return captureInTest(this.vcr, 'listVercelConnections', async () => {
      const infisicalToken = await fetchInfisicalTokenOrThrow();
      const response = await fetch(
        `https://app.infisical.com/api/v1/app-connections/vercel?projectId=${infisicalProjectId}`,
        { method: 'GET', headers: { Authorization: `Bearer ${infisicalToken}` } },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to list Vercel connections: ${response.statusText}\n${await response.text()}`,
        );
      }
      const data = (await response.json()) as {
        appConnections?: Array<{ id: string; name: string }>;
      };
      return data.appConnections ?? [];
    });
  }

  async listVercelSyncs(infisicalProjectId: string): Promise<VercelSecretSync[]> {
    return captureInTest(this.vcr, 'listVercelSyncs', async () => {
      const infisicalToken = await fetchInfisicalTokenOrThrow();
      const response = await fetch(
        `https://app.infisical.com/api/v1/secret-syncs/vercel?projectId=${infisicalProjectId}`,
        { method: 'GET', headers: { Authorization: `Bearer ${infisicalToken}` } },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to list Vercel syncs: ${response.statusText}\n${await response.text()}`,
        );
      }
      const data = (await response.json()) as { secretSyncs?: VercelSecretSync[] };
      return data.secretSyncs ?? [];
    });
  }

  async createVercelConnection(
    infisicalProjectId: string,
    vercelApiToken: string,
    connectionName: string,
  ): Promise<string> {
    return captureInTest(this.vcr, 'createVercelConnection', async () => {
      const existing = (await this.listVercelConnections(infisicalProjectId)).find(
        (c) => c.name === connectionName,
      );
      if (existing) return existing.id;

      const infisicalToken = await fetchInfisicalTokenOrThrow();
      const response = await fetch('https://app.infisical.com/api/v1/app-connections/vercel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${infisicalToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: infisicalProjectId,
          name: connectionName,
          method: 'api-token',
          credentials: { apiToken: vercelApiToken },
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Failed to create Vercel connection: ${response.statusText}\n${await response.text()}`,
        );
      }
      const data = (await response.json()) as { appConnection?: { id?: string }; id?: string };
      const connectionId = data.appConnection?.id ?? data.id;
      if (!connectionId) throw new Error(`Failed to create Vercel connection "${connectionName}"`);
      return connectionId;
    });
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
    return captureInTest(this.vcr, 'createVercelSync', async () => {
      const infisicalToken = await fetchInfisicalTokenOrThrow();
      const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/vercel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${infisicalToken}`, 'Content-Type': 'application/json' },
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
        throw new Error(
          `Failed to create Vercel sync: ${response.statusText}\n${await response.text()}`,
        );
      }
      const data = (await response.json()) as { secretSync?: { id?: string }; id?: string };
      const syncId = data.secretSync?.id ?? data.id;
      if (!syncId) throw new Error(`Failed to create Vercel sync "${syncName}"`);
      return syncId;
    });
  }

  async deleteVercelSync(syncId: string): Promise<void> {
    return captureInTest(this.vcr, 'deleteVercelSync', async () => {
      const infisicalToken = await fetchInfisicalTokenOrThrow();
      const response = await fetch(
        `https://app.infisical.com/api/v1/secret-syncs/vercel/${syncId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${infisicalToken}` },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to delete Vercel sync: ${response.statusText}\n${await response.text()}`,
        );
      }
    });
  }

  async ensureVercelSync(input: EnsureVercelSyncInput): Promise<void> {
    return captureInTest(this.vcr, 'ensureVercelSync', async () => {
      const existing = (await this.listVercelSyncs(input.infisicalProjectId)).find(
        (s) => s.name === input.syncName,
      );
      if (existing) {
        // Detect stale branch config — delete and recreate if branch setting has drifted
        const currentBranch = existing.destinationConfig?.branch;
        if (currentBranch !== input.vercelBranch && (currentBranch || input.vercelBranch)) {
          await this.deleteVercelSync(existing.id);
        } else {
          return;
        }
      }
      await this.createVercelSync(
        input.infisicalProjectId,
        input.connectionId,
        input.syncName,
        input.infisicalEnvironment,
        input.infisicalSecretPath,
        input.vercelProjectId,
        input.vercelProjectName,
        input.vercelEnvironment,
        input.vercelTeamId,
        input.vercelBranch,
      );
    });
  }
}

export const infisicalVercelApi = new InfisicalVercelApi();
