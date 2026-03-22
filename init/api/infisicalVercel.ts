import { getInfisicalToken } from './infisical';

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

/**
 * List Vercel connections in Infisical for a project
 */
const listVercelConnections = async (infisicalProjectId: string): Promise<Array<{ id: string; name: string }>> => {
  const infisicalToken = getInfisicalToken();

  const response = await fetch(
    `https://app.infisical.com/api/v1/app-connections/vercel?projectId=${infisicalProjectId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${infisicalToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Vercel connections: ${response.statusText}\n${errorText}`);
  }

  const data = (await response.json()) as { appConnections?: Array<{ id: string; name: string }> };
  return data.appConnections ?? [];
};

/**
 * List Vercel secret syncs in Infisical for a project
 */
export const listVercelSyncs = async (infisicalProjectId: string): Promise<VercelSecretSync[]> => {
  const infisicalToken = getInfisicalToken();

  const response = await fetch(`https://app.infisical.com/api/v1/secret-syncs/vercel?projectId=${infisicalProjectId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${infisicalToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Vercel syncs: ${response.statusText}\n${errorText}`);
  }

  const data = (await response.json()) as { secretSyncs?: VercelSecretSync[] };
  return data.secretSyncs ?? [];
};

/**
 * Create a Vercel connection in Infisical (idempotent - returns existing if already created)
 * This allows Infisical to sync secrets to Vercel projects
 */
export const createVercelConnection = async (
  infisicalProjectId: string,
  vercelApiToken: string,
  connectionName: string,
): Promise<string> => {
  const infisicalToken = getInfisicalToken();

  // Check if connection already exists
  const existingConnections = await listVercelConnections(infisicalProjectId);
  const existing = existingConnections.find((conn) => conn.name === connectionName);
  if (existing) {
    return existing.id;
  }

  // Create new connection
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
      credentials: {
        apiToken: vercelApiToken,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Vercel connection: ${response.statusText}\n${errorText}`);
  }

  const data = (await response.json()) as { appConnection?: { id?: string }; id?: string };
  const connectionId = data.appConnection?.id ?? data.id;
  if (!connectionId) {
    throw new Error(`Failed to create Vercel connection "${connectionName}"`);
  }
  return connectionId;
};

/**
 * Create a Vercel secret sync in Infisical
 * This syncs secrets from Infisical environment/path to a Vercel project environment
 */
export const createVercelSync = async (
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
): Promise<string> => {
  const infisicalToken = getInfisicalToken();

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
      syncOptions: {
        initialSyncBehavior: 'overwrite-destination',
      },
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
  if (!syncId) {
    throw new Error(`Failed to create Vercel sync "${syncName}"`);
  }
  return syncId;
};

/**
 * Ensure a Vercel sync exists (idempotent)
 * Creates the sync if it doesn't exist, or returns existing sync
 */
export const ensureVercelSync = async ({
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
}: EnsureVercelSyncInput): Promise<void> => {
  const existingSyncs = await listVercelSyncs(infisicalProjectId);
  const existing = existingSyncs.find((sync) => sync.name === syncName);

  if (!existing) {
    await createVercelSync(
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
    return;
  }

  // Sync already exists
};
