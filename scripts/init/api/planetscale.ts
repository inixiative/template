import { execSync } from 'node:child_process';
import { getSecret } from '../tasks/infisicalSetup';
import { getProjectConfig } from '../utils/getProjectConfig';

const PLANETSCALE_API = 'https://api.planetscale.com/v1';

type PlanetScaleOrganization = {
	id: string;
	name: string;
	slug?: string;
};

type PlanetScaleDatabase = {
	id: string;
	name: string;
	region: string;
	created_at: string;
	updated_at: string;
};

type PlanetScaleBranch = {
	id: string;
	name: string;
	region: string;
	created_at: string;
	updated_at: string;
	production: boolean;
};

type PlanetScalePassword = {
	id: string;
	name: string;
	username: string;
	plain_text: string; // Only available on creation
	connection_strings: {
		general: string;
	};
};

export type PlanetScaleRegion = {
	id: string;
	slug: string;
	display_name: string;
	enabled: boolean;
};

/**
 * Make authenticated request to PlanetScale API
 * Fetches token from Infisical automatically
 */
const planetscaleFetch = async <T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> => {
	// Get project config and fetch token ID + token from Infisical
	const config = await getProjectConfig();
	const projectId = config.infisical.projectId;

	if (!projectId) {
		throw new Error('Infisical project not configured. Run Infisical setup first.');
	}

	const tokenId = getSecret('PLANETSCALE_TOKEN_ID', {
		projectId,
		environment: 'root',
	});

	const token = getSecret('PLANETSCALE_TOKEN', {
		projectId,
		environment: 'root',
	});

	// PlanetScale requires: Authorization: <TOKEN_ID>:<TOKEN>
	const authHeader = `${tokenId}:${token}`;

	const response = await fetch(`${PLANETSCALE_API}${endpoint}`, {
		...options,
		headers: {
			'Authorization': authHeader,
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`PlanetScale API error (${response.status}): ${error}`);
	}

	return response.json();
};

/**
 * List all organizations user has access to
 * Uses CLI (pscale) instead of API since we may not have a service token yet
 */
export const listOrganizations = async (): Promise<PlanetScaleOrganization[]> => {
	const output = execSync('pscale org list --format json', { encoding: 'utf-8' });
	const orgs = JSON.parse(output);

	// Map CLI response to our Organization type
	return orgs.map((org: any) => ({
		id: org.id,
		name: org.name,
		slug: org.slug,
	}));
};

/**
 * List available regions for an organization
 */
export const listRegions = async (organizationName: string): Promise<PlanetScaleRegion[]> => {
	const output = execSync(`pscale region list --org ${organizationName} --format json`, { encoding: 'utf-8' });
	const regions = JSON.parse(output);

	// Map CLI response to our Region type
	return regions.map((region: any) => ({
		id: region.id || region.slug,
		slug: region.slug,
		display_name: region.display_name || region.name,
		enabled: region.enabled !== false,
	})).filter((r: PlanetScaleRegion) => r.enabled);
};

/**
 * Get organization details
 */
export const getOrganization = async (orgName: string): Promise<PlanetScaleOrganization> => {
	const response = await planetscaleFetch<any>(`/organizations/${orgName}`);
	return response;
};

/**
 * Create a database
 * Uses API to support all parameters including replicas
 */
export const createDatabase = async (
	organizationName: string,
	databaseName: string,
	region: string = 'us-east-1',
	clusterSize: string = 'PS-5'
): Promise<PlanetScaleDatabase> => {
	const response = await planetscaleFetch<{ data: PlanetScaleDatabase }>(
		`/organizations/${organizationName}/databases`,
		{
			method: 'POST',
			body: JSON.stringify({
				name: databaseName,
				cluster_size: clusterSize,
				region: region,
				kind: 'postgresql',
				replicas: 0
			})
		}
	);
	return response.data;
};

/**
 * Get database details
 * Uses CLI for init script (before service token exists)
 */
export const getDatabase = async (
	organizationName: string,
	databaseName: string
): Promise<PlanetScaleDatabase> => {
	const output = execSync(
		`pscale database show ${databaseName} --org ${organizationName} --format json`,
		{ encoding: 'utf-8' }
	);
	return JSON.parse(output);
};

/**
 * Update database settings
 * Uses API since CLI doesn't support configuration updates
 */
export const updateDatabaseSettings = async (
	organizationName: string,
	databaseName: string,
	settings: {
		allow_foreign_key_constraints?: boolean;
		automatic_migrations?: boolean;
		migration_table_name?: string;
		default_branch?: string;
	}
): Promise<void> => {
	await planetscaleFetch<any>(
		`/organizations/${organizationName}/databases/${databaseName}`,
		{
			method: 'PATCH',
			body: JSON.stringify(settings),
		}
	);
};

/**
 * List databases in an organization
 */
export const listDatabases = async (
	organizationName: string
): Promise<PlanetScaleDatabase[]> => {
	const response = await planetscaleFetch<any>(
		`/organizations/${organizationName}/databases`
	);
	return response.data || [];
};

/**
 * Create a branch
 * Uses CLI for init script (before service token exists)
 */
export const createBranch = async (
	organizationName: string,
	databaseName: string,
	branchName: string,
	parentBranch?: string
): Promise<PlanetScaleBranch> => {
	const parentFlag = parentBranch ? `--from ${parentBranch}` : '';
	const output = execSync(
		`pscale branch create ${databaseName} ${branchName} --org ${organizationName} ${parentFlag} --format json`,
		{ encoding: 'utf-8' }
	);
	return JSON.parse(output);
};

/**
 * Get branch details
 * Uses CLI for init script (before service token exists)
 */
export const getBranch = async (
	organizationName: string,
	databaseName: string,
	branchName: string
): Promise<PlanetScaleBranch> => {
	const output = execSync(
		`pscale branch show ${databaseName} ${branchName} --org ${organizationName} --format json`,
		{ encoding: 'utf-8' }
	);
	return JSON.parse(output);
};

/**
 * List branches for a database
 */
export const listBranches = async (
	organizationName: string,
	databaseName: string
): Promise<PlanetScaleBranch[]> => {
	const response = await planetscaleFetch<any>(
		`/organizations/${organizationName}/databases/${databaseName}/branches`
	);
	return response.data || [];
};

/**
 * Create a role (connection credentials) for a Postgres branch
 * Uses CLI for init script (before service token exists)
 */
export const createRole = async (
	organizationName: string,
	databaseName: string,
	branchName: string,
	roleName: string
): Promise<PlanetScalePassword> => {
	const output = execSync(
		`pscale role create ${databaseName} ${branchName} ${roleName} --org ${organizationName} --inherited-roles postgres --format json`,
		{ encoding: 'utf-8' }
	);
	const result = JSON.parse(output);

	const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
	const connectionString = `postgresql://${result.username}:${result.password}@${host}:5432/postgres`;

	return {
		id: result.id,
		name: result.name || roleName,
		username: result.username,
		plain_text: result.password,
		connection_strings: {
			general: connectionString,
		},
	};
};

/**
 * Create a password (connection string) for a MySQL branch
 * Uses CLI for init script (before service token exists)
 */
export const createPassword = async (
	organizationName: string,
	databaseName: string,
	branchName: string,
	passwordName: string
): Promise<PlanetScalePassword> => {
	const output = execSync(
		`pscale password create ${databaseName} ${branchName} ${passwordName} --org ${organizationName} --format json`,
		{ encoding: 'utf-8' }
	);
	const result = JSON.parse(output);

	const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
	const connectionString = `postgresql://${result.username}:${result.plain_text}@${host}:5432/postgres`;

	return {
		id: result.id,
		name: result.name,
		username: result.username,
		plain_text: result.plain_text,
		connection_strings: {
			general: connectionString,
		},
	};
};

/**
 * List passwords for a branch
 */
export const listPasswords = async (
	organizationName: string,
	databaseName: string,
	branchName: string
): Promise<PlanetScalePassword[]> => {
	const response = await planetscaleFetch<any>(
		`/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}/passwords`
	);
	return response.data || [];
};

/**
 * Promote a branch to production
 * Uses CLI for init script (before service token exists)
 */
export const promoteBranch = async (
	organizationName: string,
	databaseName: string,
	branchName: string
): Promise<PlanetScaleBranch> => {
	const output = execSync(
		`pscale branch promote ${databaseName} ${branchName} --org ${organizationName} --format json`,
		{ encoding: 'utf-8' }
	);
	return JSON.parse(output);
};

/**
 * Rename a branch
 * Uses API to rename branches
 */
export const renameBranch = async (
	organizationName: string,
	databaseName: string,
	branchName: string,
	newName: string
): Promise<PlanetScaleBranch> => {
	const response = await planetscaleFetch<any>(
		`/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				new_name: newName,
			}),
		}
	);
	return response;
};

/**
 * Delete a branch
 * Uses CLI for init script (before service token exists)
 */
export const deleteBranch = async (
	organizationName: string,
	databaseName: string,
	branchName: string
): Promise<void> => {
	execSync(
		`pscale branch delete ${databaseName} ${branchName} --org ${organizationName} --force`,
		{ encoding: 'utf-8' }
	);
};

type ServiceToken = {
	id: string;
	token: string;
};

/**
 * Create a PlanetScale service token via CLI
 */
export const createServiceToken = async (
	orgName: string
): Promise<ServiceToken> => {
	const output = execSync(
		`pscale service-token create --org ${orgName} --format json`,
		{ encoding: 'utf-8' }
	);

	const result = JSON.parse(output);
	return {
		id: result.id,
		token: result.token,
	};
};
