import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getSecret, setSecret } from '../tasks/infisicalSetup';
import { getProjectConfig } from '../utils/getProjectConfig';
import { retryWithTimeout } from '../utils/retry';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_CONFIG_PATH = join(homedir(), '.railway', 'config.json');

// Type definitions for Railway API responses

export type RailwayWorkspace = {
	id: string;
	name: string;
};

export type RailwayProject = {
	id: string;
	name: string;
	workspaceId: string;
	createdAt: string;
};

export type RailwayService = {
	id: string;
	name: string;
	projectId: string;
	serviceInstanceId?: string;
	domains?: string[];
};

export type RailwayRedis = {
	id: string;
	name: string;
	projectId: string;
	environmentId?: string;
};

export type RailwayDeployment = {
	id: string;
	status: 'BUILDING' | 'DEPLOYING' | 'SUCCESS' | 'FAILED' | 'CRASHED';
	url?: string;
};

/**
 * Get Railway user session token (JWT format, >255 chars)
 * Used for GraphQL API authentication
 * Priority: 1) Infisical, 2) Railway CLI config
 */
export const getRailwayUserToken = async (): Promise<string> => {
	const config = await getProjectConfig();
	const projectId = config.infisical.projectId;

	if (!projectId) {
		throw new Error('Infisical project not configured. Run Infisical setup first.');
	}

	// First, check Infisical (source of truth)
	try {
		const token = getSecret('RAILWAY_USER_TOKEN', {
			projectId,
			environment: 'root',
		});

		if (token) {
			return token;
		}
	} catch (error) {
		// Token not in Infisical, try Railway CLI config
	}

	// Not in Infisical - check Railway CLI config
	if (existsSync(RAILWAY_CONFIG_PATH)) {
		try {
			const railwayConfig = JSON.parse(readFileSync(RAILWAY_CONFIG_PATH, 'utf-8'));
			const token = railwayConfig?.user?.token;

			if (token) {
				// Upload to Infisical for future use
				setSecret(projectId, 'root', 'RAILWAY_USER_TOKEN', token);
				return token;
			}
		} catch (error) {
			// Fall through to error
		}
	}

	throw new Error('Railway user token not found. Please run: railway login');
};

/**
 * Get Railway workspace token (UUID format, ~36 chars)
 * Used for Infisical Railway connection (must be <255 chars)
 * Create at: https://railway.com/account/tokens
 */
export const getRailwayWorkspaceToken = async (): Promise<string> => {
	const config = await getProjectConfig();
	const projectId = config.infisical.projectId;

	if (!projectId) {
		throw new Error('Infisical project not configured. Run Infisical setup first.');
	}

	// Check Infisical for workspace token
	try {
		const token = getSecret('RAILWAY_WORKSPACE_TOKEN', {
			projectId,
			environment: 'root',
		});

		if (token) {
			return token;
		}
	} catch (error) {
		// Not found
	}

	throw new Error(
		'Railway workspace token not found. Create one at https://railway.com/account/tokens ' +
		'and add it to Infisical root environment as RAILWAY_WORKSPACE_TOKEN'
	);
};

/**
 * Make authenticated GraphQL request to Railway API
 */
const railwayGraphQLWithToken = async <T>(
	token: string,
	query: string,
	variables?: Record<string, any>
): Promise<T> => {
	const response = await fetch(RAILWAY_API, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unable to read response body');
		throw new Error(
			`Railway API error: ${response.status} ${response.statusText}\n` +
			`Endpoint: ${RAILWAY_API}\n` +
			`Response: ${errorBody}`
		);
	}

	const result = await response.json();

	// GraphQL errors are returned in the response
	if (result.errors && result.errors.length > 0) {
		const errorMessages = result.errors.map((e: any) => e.message).join(', ');
		throw new Error(`Railway GraphQL error: ${errorMessages}`);
	}

	return result.data as T;
};

const railwayGraphQLUser = async <T>(
	query: string,
	variables?: Record<string, any>
): Promise<T> => {
	const token = await getRailwayUserToken();
	return railwayGraphQLWithToken<T>(token, query, variables);
};

const railwayGraphQLWorkspace = async <T>(
	query: string,
	variables?: Record<string, any>
): Promise<T> => {
	const token = await getRailwayWorkspaceToken();
	return railwayGraphQLWithToken<T>(token, query, variables);
};

/**
 * List all workspaces for the authenticated user
 * Uses Railway CLI instead of GraphQL API for reliability
 */
export const listWorkspaces = async (): Promise<RailwayWorkspace[]> => {
	try {
		const { stdout } = await execAsync('railway whoami --json', { encoding: 'utf-8' });
		const data = JSON.parse(stdout.trim());
		return data.workspaces || [];
	} catch (error) {
		// If CLI fails, return empty array
		return [];
	}
};

/**
 * Create a new Railway project using CLI
 */
export const createProject = async (
	workspaceId: string,
	name: string
): Promise<RailwayProject> => {
	try {
		const { stdout } = await execAsync(
			`railway init -n "${name}" -w "${workspaceId}" --json`,
			{ encoding: 'utf-8' }
		);

		// Railway CLI outputs prompts before JSON
		// Find the line that starts with { (the actual JSON)
		const lines = stdout.split('\n');
		const jsonLine = lines.find(line => line.trim().startsWith('{'));

		if (!jsonLine) {
			throw new Error(`No JSON output found. Raw output: ${stdout}`);
		}

		const data = JSON.parse(jsonLine);

		return {
			id: data.id,
			name: data.name,
			workspaceId: workspaceId,
			createdAt: new Date().toISOString(),
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to create Railway project: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Get serviceInstance ID with retry logic to handle provisioning delay
 * Railway needs time to provision serviceInstance after service creation
 */
const getServiceInstanceId = async (
	serviceId: string,
	environmentId: string
): Promise<string> => {
	return retryWithTimeout(
		async () => {
			const query = `
				query ServiceInstance($serviceId: String!, $environmentId: String!) {
					serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
						id
					}
				}
			`;

			const data = await railwayGraphQLUser<{
				serviceInstance: { id: string } | null;
			}>(query, { serviceId, environmentId });

			if (!data.serviceInstance?.id) {
				throw new Error(
					`Service instance not found for service ${serviceId} in environment ${environmentId}`
				);
			}

			return data.serviceInstance.id;
		},
		{
			maxRetries: 10,
			delayMs: 2000,
			retryCondition: (error) => error.message.includes('Service instance not found'),
			timeoutMessage: 'Timed out waiting for serviceInstance to be provisioned'
		}
	);
};

export const isServiceConnectedToGitHub = async (
	serviceId: string,
	environmentId: string
): Promise<boolean> => {
	const query = `
		query ServiceInstance($serviceId: String!, $environmentId: String!) {
			serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
				id
				source {
					repo
				}
			}
		}
	`;

	const data = await railwayGraphQLUser<{
		serviceInstance: { id: string; source: { repo: string } | null } | null;
	}>(query, { serviceId, environmentId });

	const repo = data.serviceInstance?.source?.repo;
	return !!repo;
};

/**
 * Connect a service to a GitHub repository
 * Uses service instance source update because serviceConnect is currently unauthorized.
 */
export const connectServiceToGitHub = async (
	serviceId: string,
	environmentId: string,
	repo: string,
	branch: string = 'main'
): Promise<void> => {
	void branch;
	const data = await railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(
		`
			mutation ServiceInstanceUpdate(
				$serviceId: String!,
				$environmentId: String!,
				$input: ServiceInstanceUpdateInput!
			) {
				serviceInstanceUpdate(
					serviceId: $serviceId,
					environmentId: $environmentId,
					input: $input
				)
			}
		`,
		{
			serviceId,
			environmentId,
			input: {
				source: { repo },
			},
		}
	);

	if (!data.serviceInstanceUpdate) {
		throw new Error(
			`Failed to connect service ${serviceId} to GitHub repository ${repo} in environment ${environmentId}`
		);
	}
};

/**
 * Rename a service (works for both custom services and databases like Redis)
 */
export const renameService = async (
	serviceId: string,
	name: string
): Promise<void> => {
	const mutation = `
		mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
			serviceUpdate(id: $id, input: $input) {
				id
				name
			}
		}
	`;

	await railwayGraphQLUser<{ serviceUpdate: { id: string; name: string } }>(mutation, {
		id: serviceId,
		input: {
			name,
		},
	});
};

/**
 * Update service instance runtime settings for a specific environment
 */
/**
 * Update service instance configuration (build/start commands, root directory)
 * Used to configure Railway service build and runtime settings
 */
export const updateServiceInstanceConfig = async (
	serviceId: string,
	environmentId: string,
	input: {
		rootDirectory?: string;
		buildCommand?: string;
		startCommand?: string;
	}
): Promise<void> => {
	const mutation = `
		mutation ServiceInstanceUpdate(
			$serviceId: String!,
			$environmentId: String!,
			$input: ServiceInstanceUpdateInput!
		) {
			serviceInstanceUpdate(
				serviceId: $serviceId,
				environmentId: $environmentId,
				input: $input
			)
		}
	`;

	const data = await railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(mutation, {
		serviceId,
		environmentId,
		input,
	});

	if (!data.serviceInstanceUpdate) {
		throw new Error(
			`Failed to update service instance config for service ${serviceId} in environment ${environmentId}`
		);
	}
};

/**
 * Get all volumes for a project
 */
export const getProjectVolumes = async (
	projectId: string
): Promise<Array<{ id: string; name: string }>> => {
	const query = `
		query Project($id: String!) {
			project(id: $id) {
				volumes {
					edges {
						node {
							id
							name
						}
					}
				}
			}
		}
	`;

	const data = await railwayGraphQLUser<{
		project: {
			volumes: {
				edges: Array<{
					node: {
						id: string;
						name: string;
					};
				}>;
			};
		};
	}>(query, { id: projectId });

	return data.project.volumes.edges.map(edge => edge.node);
};

/**
 * Get volume for a service by matching the most recently created volume
 * Since Railway creates volumes when adding Redis, the newest volume should be ours
 */
export const getServiceVolume = async (
	projectId: string,
	serviceName: string
): Promise<{ id: string; name: string } | null> => {
	// Get all volumes for the project
	const volumes = await getProjectVolumes(projectId);

	// For Redis services, Railway auto-creates volumes with names like "Redis" or similar
	// We'll return the most recently added volume (last in the list)
	// This assumes we call this immediately after creating the service
	if (volumes.length > 0) {
		return volumes[volumes.length - 1];
	}

	return null;
};

/**
 * Rename a volume
 */
export const renameVolume = async (
	volumeId: string,
	name: string
): Promise<void> => {
	const mutation = `
		mutation VolumeUpdate($volumeId: String!, $input: VolumeUpdateInput!) {
			volumeUpdate(volumeId: $volumeId, input: $input) {
				id
				name
			}
		}
	`;

	await railwayGraphQLUser<{ volumeUpdate: { id: string; name: string } }>(mutation, {
		volumeId,
		input: {
			name,
		},
	});
};

/**
 * Create a service (API or Worker) using CLI
 */
export const createService = async (
	projectId: string,
	environmentId: string,
	environmentName: string,
	name: string
): Promise<RailwayService> => {
	// Link to environment first
	await execAsync(`railway environment link ${environmentName}`, {
		encoding: 'utf-8',
		cwd: process.cwd(),
		env: {
			...process.env,
			RAILWAY_PROJECT_ID: projectId,
		}
	});

	// Escape special characters to prevent command injection
	const escapeName = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	const escapedName = escapeName(name);

	// Create service without repo linkage; GitHub connect happens in explicit connect step.
	const { stdout } = await execAsync(`railway add --service "${escapedName}" --json`, {
		encoding: 'utf-8',
		cwd: process.cwd(),
		env: {
			...process.env,
			RAILWAY_PROJECT_ID: projectId,
		}
	});

	// Find JSON line
	const lines = stdout.split('\n');
	const jsonLine = lines.find(line => line.trim().startsWith('{'));

	if (!jsonLine) {
		throw new Error(`No JSON output found. Raw output: ${stdout}`);
	}

	const data = JSON.parse(jsonLine);

	return {
		id: data.id || data.serviceId,
		name: data.name || name,
		projectId,
	};
};

/**
 * Get project environments using CLI
 * Note: Railway CLI doesn't have a direct command for this, so we still use GraphQL
 */
export const getProjectEnvironments = async (
	projectId: string
): Promise<Array<{ id: string; name: string }>> => {
	const query = `
		query GetEnvironments($projectId: String!) {
			project(id: $projectId) {
				environments {
					edges {
						node {
							id
							name
						}
					}
				}
			}
		}
	`;

	const data = await railwayGraphQLUser<{
		project: { environments: { edges: Array<{ node: { id: string; name: string } }> } };
	}>(query, { projectId });

	return data.project.environments.edges.map((edge) => edge.node);
};

/**
 * Create a new environment using CLI
 */
export const createEnvironment = async (
	projectId: string,
	name: string,
	sourceEnvironmentId?: string
): Promise<{ id: string; name: string }> => {
	try {
		// Build command - duplicate from source if provided
		const duplicateFlag = sourceEnvironmentId ? `--duplicate ${sourceEnvironmentId}` : '';
		const { stdout } = await execAsync(
			`railway environment new "${name}" ${duplicateFlag} --json`,
			{
				encoding: 'utf-8',
				cwd: process.cwd(),
				env: {
					...process.env,
					RAILWAY_PROJECT_ID: projectId,
				}
			}
		);

		// Find JSON line (CLI may output prompts)
		const lines = stdout.split('\n');
		const jsonLine = lines.find(line => line.trim().startsWith('{'));

		if (!jsonLine) {
			throw new Error(`No JSON output found. Raw output: ${stdout}`);
		}

		const data = JSON.parse(jsonLine);

		return {
			id: data.id || data.environmentId,
			name: data.name || name,
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to create environment: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Delete an environment using CLI
 */
export const deleteEnvironment = async (
	projectId: string,
	environmentName: string
): Promise<void> => {
	try {
		await execAsync(
			`railway environment delete "${environmentName}" --yes --json`,
			{
				encoding: 'utf-8',
				cwd: process.cwd(),
				env: {
					...process.env,
					RAILWAY_PROJECT_ID: projectId,
				}
			}
		);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to delete environment: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Rename an environment
 */
export const renameEnvironment = async (
	environmentId: string,
	newName: string
): Promise<boolean> => {
	const mutation = `
		mutation RenameEnvironment($id: String!, $name: String!) {
			environmentRename(id: $id, input: { name: $name })
		}
	`;

	const data = await railwayGraphQLUser<{ environmentRename: boolean }>(mutation, {
		id: environmentId,
		name: newName,
	});

	return data.environmentRename;
};

/**
 * Provision Redis database using CLI
 * Links to environment first, then adds Redis
 */
export const createRedis = async (
	projectId: string,
	environmentId: string,
	environmentName: string
): Promise<RailwayRedis> => {
	try {
		// Step 1: Link to the environment
		await execAsync(
			`railway environment link ${environmentName}`,
			{
				encoding: 'utf-8',
				cwd: process.cwd(),
				env: {
					...process.env,
					RAILWAY_PROJECT_ID: projectId,
				}
			}
		);

		// Step 2: Add Redis to the linked environment
		// Note: Railway CLI doesn't support custom naming for databases
		const { stdout } = await execAsync(
			`railway add -d redis --json`,
			{
				encoding: 'utf-8',
				cwd: process.cwd(),
				env: {
					...process.env,
					RAILWAY_PROJECT_ID: projectId,
				}
			}
		);

		// Find JSON line (CLI may output prompts)
		const lines = stdout.split('\n');
		const jsonLine = lines.find(line => line.trim().startsWith('{'));

		if (!jsonLine) {
			throw new Error(`No JSON output found. Raw output: ${stdout}`);
		}

		const data = JSON.parse(jsonLine);

		return {
			id: data.serviceId || data.id,
			name: data.name || 'redis',
			projectId,
			environmentId,
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to provision Redis: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Get Redis connection URL using CLI
 */
export const getRedisUrl = async (
	serviceId: string,
	environmentId: string,
	environmentName: string,
	projectId: string
): Promise<string> => {
	try {
		const { stdout } = await execAsync(
			`railway variables list -s ${serviceId} -e ${environmentName} --json`,
			{
				encoding: 'utf-8',
				cwd: process.cwd(),
				env: {
					...process.env,
					RAILWAY_PROJECT_ID: projectId,
				}
			}
		);

		const variables = JSON.parse(stdout.trim());

		// Find REDIS_URL in the variables
		const redisUrl = variables.REDIS_URL;

		if (!redisUrl) {
			throw new Error('REDIS_URL not found in service variables');
		}

		return redisUrl;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to get Redis URL: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Set environment variables for a service
 */
export const setEnvironmentVariables = async (
	serviceId: string,
	environmentId: string,
	variables: Record<string, string>
): Promise<void> => {
	const mutation = `
		mutation SetVariables($serviceId: String!, $environmentId: String!, $variables: String!) {
			variableCollectionUpsert(input: { serviceId: $serviceId, environmentId: $environmentId, variables: $variables }) {
				id
			}
		}
	`;

	// Railway expects variables as JSON string
	const variablesJson = JSON.stringify(variables);

	await railwayGraphQLUser<{ variableCollectionUpsert: { id: string } }>(mutation, {
		serviceId,
		environmentId,
		variables: variablesJson,
	});
};

/**
 * Get latest deployment for a service in an environment
 */
export const getLatestDeployment = async (
	serviceId: string,
	environmentId: string
): Promise<RailwayDeployment | null> => {
	const query = `
		query ServiceInstance($serviceId: String!, $environmentId: String!) {
			serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
				latestDeployment {
					id
					status
				}
			}
		}
	`;

	const data = await railwayGraphQLUser<{
		serviceInstance: { latestDeployment: RailwayDeployment | null };
	}>(query, { serviceId, environmentId });

	return data.serviceInstance.latestDeployment;
};

/**
 * Trigger a deployment for a connected service instance.
 * Uses latest commit from connected source.
 */
export const triggerServiceDeployment = async (
	serviceId: string,
	environmentId: string
): Promise<void> => {
	const mutation = `
		mutation ServiceInstanceDeploy(
			$serviceId: String!,
			$environmentId: String!,
			$latestCommit: Boolean!
		) {
			serviceInstanceDeploy(
				serviceId: $serviceId,
				environmentId: $environmentId,
				latestCommit: $latestCommit
			)
		}
	`;

	const data = await railwayGraphQLUser<{ serviceInstanceDeploy: boolean }>(mutation, {
		serviceId,
		environmentId,
		latestCommit: true,
	});

	if (!data.serviceInstanceDeploy) {
		throw new Error(
			`Failed to trigger deployment for service ${serviceId} in environment ${environmentId}`
		);
	}
};

/**
 * Get service domain (public URL)
 */
export const getServiceDomain = async (
	serviceId: string,
	environmentId: string
): Promise<string | null> => {
	const query = `
		query GetServiceDomain($serviceId: String!, $environmentId: String!) {
			serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
				domains {
					serviceDomains {
						domain
					}
				}
			}
		}
	`;

	const data = await railwayGraphQLUser<{
		serviceInstance: {
			domains: {
				serviceDomains: Array<{ domain: string }>;
			};
		};
	}>(query, { serviceId, environmentId });

	const domains = data.serviceInstance.domains.serviceDomains;
	return domains.length > 0 ? `https://${domains[0].domain}` : null;
};

/**
 * Create a Railway service from a Docker image.
 *
 * Steps:
 *   1. serviceCreate — creates an empty service in the project
 *   2. serviceInstanceUpdate — sets the Docker image source on the given environment
 *
 * ⚠ ServiceInstanceUpdateInput.source shape for images is `{ image }` by analogy
 *   with `{ repo }` used for GitHub connections — verify against Railway schema if issues arise.
 */
export const createImageService = async (
	projectId: string,
	environmentId: string,
	serviceName: string,
	image: string
): Promise<{ serviceId: string }> => {
	// Step 1: Create empty service
	const createMutation = `
		mutation ServiceCreate($input: ServiceCreateInput!) {
			serviceCreate(input: $input) {
				id
			}
		}
	`;

	const createData = await railwayGraphQLUser<{ serviceCreate: { id: string } }>(
		createMutation,
		{ input: { projectId, name: serviceName } }
	);

	const serviceId = createData.serviceCreate.id;

	// Step 2: Set Docker image source on the staging environment instance
	const updateMutation = `
		mutation ServiceInstanceUpdate(
			$serviceId: String!,
			$environmentId: String!,
			$input: ServiceInstanceUpdateInput!
		) {
			serviceInstanceUpdate(
				serviceId: $serviceId,
				environmentId: $environmentId,
				input: $input
			)
		}
	`;

	await railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(updateMutation, {
		serviceId,
		environmentId,
		input: {
			source: { image },
		},
	});

	return { serviceId };
};

/**
 * Set up Infisical integration for automatic environment variable syncing
 * Railway will pull variables from Infisical automatically
 */
export const setupInfisicalIntegration = async (
	projectId: string,
	environmentId: string,
	infisicalProjectId: string,
	infisicalEnvironment: string,
	infisicalPath: string = '/'
): Promise<{ id: string }> => {
	// Note: This mutation structure needs to be verified against Railway's actual GraphQL schema
	// Railway's API for integrations may differ - check Railway docs for exact format
	const mutation = `
		mutation SetupInfisicalIntegration(
			$projectId: String!,
			$environmentId: String!,
			$infisicalProjectId: String!,
			$infisicalEnvironment: String!,
			$infisicalPath: String!
		) {
			integrationCreate(input: {
				projectId: $projectId,
				environmentId: $environmentId,
				integration: INFISICAL,
				config: {
					projectId: $infisicalProjectId,
					environment: $infisicalEnvironment,
					path: $infisicalPath
				}
			}) {
				id
			}
		}
	`;

	const data = await railwayGraphQLUser<{ integrationCreate: { id: string } }>(mutation, {
		projectId,
		environmentId,
		infisicalProjectId,
		infisicalEnvironment,
		infisicalPath,
	});

	return data.integrationCreate;
};
