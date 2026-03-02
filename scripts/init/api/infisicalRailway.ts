import { getInfisicalToken } from './infisical';

/**
 * List Railway connections in Infisical for a project
 */
const listRailwayConnections = async (
	infisicalProjectId: string
): Promise<Array<{ id: string; name: string }>> => {
	const infisicalToken = getInfisicalToken();

	const response = await fetch(
		`https://app.infisical.com/api/v1/app-connections/railway?projectId=${infisicalProjectId}`,
		{
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${infisicalToken}`,
			},
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to list Railway connections: ${response.statusText}\n${errorText}`);
	}

	const data = await response.json();
	return data.appConnections || [];
};

/**
 * Create a Railway connection in Infisical (idempotent - returns existing if already created)
 * This allows Infisical to sync secrets to Railway projects
 */
export const createRailwayConnection = async (
	infisicalProjectId: string,
	railwayApiToken: string,
	connectionName: string
): Promise<string> => {
	const infisicalToken = getInfisicalToken();

	const response = await fetch('https://app.infisical.com/api/v1/app-connections/railway', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${infisicalToken}`,
		},
		body: JSON.stringify({
			name: connectionName,
			method: 'team-token',
			projectId: infisicalProjectId,
			credentials: {
				apiToken: railwayApiToken,
			}
		})
	});

	if (!response.ok) {
		const errorText = await response.text();

		// If connection already exists, find and return its ID
		if (errorText.includes('already exists')) {
			const connections = await listRailwayConnections(infisicalProjectId);
			const existing = connections.find(conn => conn.name === connectionName);
			if (existing) {
				return existing.id;
			}
		}

		throw new Error(`Failed to create Railway connection in Infisical: ${response.statusText}\n${errorText}`);
	}

	const data = await response.json();

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
	railwayEnvironmentName: string
): Promise<void> => {
	const infisicalToken = getInfisicalToken();

	const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/railway', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${infisicalToken}`,
		},
		body: JSON.stringify({
			name: syncName,
			projectId: infisicalProjectId,
			environment: infisicalEnvironment,
			secretPath: infisicalSecretPath,
			connectionId,
			syncOptions: {
				initialSyncBehavior: 'import-prioritize-source'
			},
			destinationConfig: {
				projectId: railwayProjectId,
				projectName: railwayProjectName,
				environmentId: railwayEnvironmentId,
				environmentName: railwayEnvironmentName
			}
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to create Railway sync "${syncName}": ${response.statusText}\n${errorText}`);
	}
};
