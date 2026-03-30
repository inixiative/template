import { getInfisicalToken } from './infisical';

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

/**
 * List Railway connections in Infisical for a project
 */
const listRailwayConnections = async (infisicalProjectId: string): Promise<Array<{ id: string; name: string }>> => {
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
};

/**
 * List Railway secret syncs in Infisical for a project
 */
export const listRailwaySyncs = async (infisicalProjectId: string): Promise<RailwaySecretSync[]> => {
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
};

/**
 * Create a Railway connection in Infisical (idempotent - returns existing if already created)
 * This allows Infisical to sync secrets to Railway projects
 */
export const createRailwayConnection = async (
  infisicalProjectId: string,
  railwayApiToken: string,
  connectionName: string,
): Promise<string> => {
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

    // If connection already exists, find and return its ID
    if (errorText.includes('already exists')) {
      const connections = await listRailwayConnections(infisicalProjectId);
      const existing = connections.find((conn) => conn.name === connectionName);
      if (existing) {
        return existing.id;
      }
    }

    throw new Error(`Failed to create Railway connection in Infisical: ${response.statusText}\n${errorText}`);
  }

  const data = (await response.json()) as { appConnection?: { id?: string } };

  // Response is { appConnection: { id, ... } }
  if (data.appConnection?.id) {
    return data.appConnection.id;
  } else {
    throw new Error(`Unexpected Infisical API response: ${JSON.stringify(data)}`);
  }
};

/**
 * Create a secret sync from Infisical to Railway
 */
export const createRailwaySync = async (
  infisicalProjectId: string,
  connectionId: string,
  syncName: string,
  infisicalEnvironment: string,
  infisicalSecretPath: string,
  railwayProjectId: string,
  railwayProjectName: string,
  railwayEnvironmentId: string,
  railwayEnvironmentName: string,
  railwayServiceId: string,
  railwayServiceName: string,
): Promise<void> => {
  const infisicalToken = await getInfisicalToken();

  const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/railway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${infisicalToken}`,
    },
    body: JSON.stringify({
      name: syncName,
      projectId: infisicalProjectId,
      environment: infisicalEnvironment,
      secretPath: infisicalSecretPath,
      connectionId,
      syncOptions: {
        initialSyncBehavior: 'import-prioritize-source',
      },
      destinationConfig: {
        projectId: railwayProjectId,
        projectName: railwayProjectName,
        environmentId: railwayEnvironmentId,
        environmentName: railwayEnvironmentName,
        serviceId: railwayServiceId,
        serviceName: railwayServiceName,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Railway sync "${syncName}": ${response.statusText}\n${errorText}`);
  }
};

/**
 * Ensure a service-scoped Railway sync exists and matches expected config
 */
export const ensureRailwaySync = async ({
  infisicalProjectId,
  connectionId,
  syncName,
  infisicalEnvironment,
  infisicalSecretPath,
  railwayProjectId,
  railwayProjectName,
  railwayEnvironmentId,
  railwayEnvironmentName,
  railwayServiceId,
  railwayServiceName,
}: EnsureRailwaySyncInput): Promise<void> => {
  const existingSyncs = await listRailwaySyncs(infisicalProjectId);
  const existing = existingSyncs.find((sync) => sync.name === syncName);

  if (!existing) {
    await createRailwaySync(
      infisicalProjectId,
      connectionId,
      syncName,
      infisicalEnvironment,
      infisicalSecretPath,
      railwayProjectId,
      railwayProjectName,
      railwayEnvironmentId,
      railwayEnvironmentName,
      railwayServiceId,
      railwayServiceName,
    );
    return;
  }

  const mismatches: string[] = [];
  if ((existing.environment?.slug || '') !== infisicalEnvironment) {
    mismatches.push(`environment: expected "${infisicalEnvironment}", got "${existing.environment?.slug || ''}"`);
  }
  if ((existing.folder?.path || '') !== infisicalSecretPath) {
    mismatches.push(`secretPath: expected "${infisicalSecretPath}", got "${existing.folder?.path || ''}"`);
  }

  const destinationConfig = existing.destinationConfig || {};
  if ((destinationConfig.projectId || '') !== railwayProjectId) {
    mismatches.push(`projectId: expected "${railwayProjectId}", got "${destinationConfig.projectId || ''}"`);
  }
  if ((destinationConfig.environmentId || '') !== railwayEnvironmentId) {
    mismatches.push(
      `environmentId: expected "${railwayEnvironmentId}", got "${destinationConfig.environmentId || ''}"`,
    );
  }
  if ((destinationConfig.serviceId || '') !== railwayServiceId) {
    mismatches.push(`serviceId: expected "${railwayServiceId}", got "${destinationConfig.serviceId || ''}"`);
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Railway sync "${syncName}" exists with mismatched config:\n` +
        mismatches.map((mismatch) => `  - ${mismatch}`).join('\n'),
    );
  }
};
