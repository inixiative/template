import { execSync } from 'node:child_process';

const INFISICAL_API = 'https://app.infisical.com/api';

export type InfisicalApp = 'api' | 'web' | 'admin' | 'superadmin';

type InfisicalProject = {
	id: string;
	name: string;
	slug: string;
};

type InfisicalEnvironment = {
	id: string;
	name: string;
	slug: string;
};

/**
 * Get Infisical access token from CLI session
 */
export const getInfisicalToken = (): string => {
	try {
		const output = execSync('infisical user get token', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		const tokenMatch = output.match(/Token: (.+)/);
		if (!tokenMatch) throw new Error('Failed to parse token from infisical user get token');

		return tokenMatch[1];
	} catch (error) {
		throw new Error(`Failed to get Infisical token: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};

/**
 * Make authenticated request to Infisical API
 */
const infisicalFetch = async <T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> => {
	const token = getInfisicalToken();

	const response = await fetch(`${INFISICAL_API}${endpoint}`, {
		...options,
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Infisical API error (${response.status}): ${error}`);
	}

	return response.json();
};

/**
 * Get organization ID from token
 */
export const getOrganizationId = (): string => {
	const token = getInfisicalToken();
	const payload = JSON.parse(atob(token.split('.')[1]));
	return payload.organizationId;
};

/**
 * List all organizations user has access to
 */
export const listOrganizations = async (): Promise<any[]> => {
	const response = await infisicalFetch<any>('/v1/organization');
	return response.organizations || [];
};

/**
 * Get organization details including slug
 */
export const getOrganization = async (organizationId: string): Promise<any> => {
	return await infisicalFetch(`/v1/organization/${organizationId}`);
};

/**
 * Update project/workspace slug
 */
export const updateProjectSlug = async (
	projectId: string,
	slug: string
): Promise<any> => {
	return await infisicalFetch(`/v2/workspace/${projectId}`, {
		method: 'PATCH',
		body: JSON.stringify({ slug }),
	});
};

/**
 * Create or get existing project (upsert)
 */
export const upsertProject = async (name: string): Promise<InfisicalProject> => {
	const orgId = getOrganizationId();

	// Check if exists
	const listResponse = await infisicalFetch<any>(
		`/v2/organizations/${orgId}/workspaces`
	);
	const existing = listResponse.workspaces?.find((p: any) => p.name === name);
	if (existing) return existing;

	// Create new with explicit slug to avoid random suffix
	const createResponse = await infisicalFetch<any>('/v2/workspace', {
		method: 'POST',
		body: JSON.stringify({
			projectName: name,
			slug: name, // Explicitly set slug to prevent random suffix
		}),
	});

	return createResponse.workspace || createResponse.project;
};

/**
 * Create or get existing environment (upsert)
 */
export const upsertEnvironment = async (
	projectId: string,
	name: string,
	slug: string
): Promise<InfisicalEnvironment> => {
	try {
		// Try to create - will fail if already exists
		const createResponse = await infisicalFetch<{ environment: InfisicalEnvironment }>(
			`/v1/projects/${projectId}/environments`,
			{
				method: 'POST',
				body: JSON.stringify({ name, slug }),
			}
		);

		return createResponse.environment;
	} catch (error) {
		// If already exists, that's fine - return a minimal object
		// The API doesn't provide a way to list/get individual environments
		if (error instanceof Error && error.message.includes('already exists')) {
			return { id: '', name, slug };
		}
		throw error;
	}
};

/**
 * Delete an environment
 */
export const deleteEnvironment = async (
	projectId: string,
	environmentId: string
): Promise<void> => {
	await infisicalFetch(`/v1/projects/${projectId}/environments/${environmentId}`, {
		method: 'DELETE',
	});
};

/**
 * Update/rename an environment
 */
export const updateEnvironment = async (
	projectId: string,
	environmentId: string,
	updates: { name?: string; slug?: string; position?: number }
): Promise<InfisicalEnvironment> => {
	const response = await infisicalFetch<{ environment: InfisicalEnvironment }>(
		`/v1/projects/${projectId}/environments/${environmentId}`,
		{
			method: 'PATCH',
			body: JSON.stringify(updates),
		}
	);
	return response.environment;
};

/**
 * Get full project details including environment IDs
 */
export const getProject = async (projectId: string): Promise<any> => {
	return await infisicalFetch(`/v1/workspace/${projectId}`);
};

/**
 * Create a folder at a specific path in an environment
 */
export const createFolder = async (
	projectId: string,
	environment: string,
	name: string,
	path: string = '/'
): Promise<any> => {
	try {
		return await infisicalFetch('/v2/folders', {
			method: 'POST',
			body: JSON.stringify({ projectId, environment, name, path }),
		});
	} catch (error) {
		// Ignore if folder already exists
		if (error instanceof Error && error.message.includes('already exists')) {
			return null;
		}
		throw error;
	}
};

/**
 * Create secret import (environment inheritance)
 */
export const createSecretImport = async (
	projectId: string,
	destinationEnvironment: string,
	destinationPath: string,
	sourceEnvironment: string,
	sourcePath: string
): Promise<void> => {
	try {
		await infisicalFetch('/v2/secret-imports', {
			method: 'POST',
			body: JSON.stringify({
				projectId,
				environment: destinationEnvironment,
				path: destinationPath,
				import: {
					environment: sourceEnvironment,
					path: sourcePath,
				},
			}),
		});
	} catch (error) {
		// Ignore if import already exists
		if (error instanceof Error && error.message.includes('already exists')) {
			return;
		}
		throw error;
	}
};

/**
 * Create or update a secret
 */
export const setSecret = async (
	projectId: string,
	environment: 'root' | 'staging' | 'prod',
	path: '/' | `/${InfisicalApp}/`,
	key: string,
	value: string,
	type: 'shared' | 'personal' = 'shared'
): Promise<void> => {
	try {
		await infisicalFetch('/v3/secrets/raw', {
			method: 'POST',
			body: JSON.stringify({
				workspaceId: projectId,
				environment,
				secretPath: path,
				secretKey: key,
				secretValue: value,
				type,
			}),
		});
	} catch (error) {
		// If secret exists, update it instead
		if (error instanceof Error && error.message.includes('already exists')) {
			await infisicalFetch(`/v3/secrets/raw/${key}`, {
				method: 'PATCH',
				body: JSON.stringify({
					workspaceId: projectId,
					environment,
					secretPath: path,
					secretValue: value,
					type,
				}),
			});
		} else {
			throw error;
		}
	}
};

