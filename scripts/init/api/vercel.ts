import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type VercelTeam = {
	id: string;
	name: string;
	slug: string;
};

export type VercelProject = {
	id: string;
	name: string;
	framework: string | null;
};

/**
 * List all teams/orgs for the authenticated user
 * Uses Vercel API to get proper team IDs
 */
export const listTeams = async (): Promise<VercelTeam[]> => {
	try {
		const result = await vercelAPI('/v2/teams', 'GET');

		if (result.error) {
			console.error('Failed to list teams:', result.error);
			return [];
		}

		const teams: VercelTeam[] = (result.teams || []).map((team: any) => ({
			id: team.id,
			name: team.name,
			slug: team.slug
		}));

		return teams;
	} catch (error) {
		console.error('Failed to list teams:', error);
		return [];
	}
};

/**
 * Create a new Vercel project
 */
export const createProject = async (
	projectName: string,
	teamId?: string
): Promise<VercelProject> => {
	try {
		const teamFlag = teamId ? `--scope ${teamId}` : '';
		const { stdout, stderr } = await execAsync(
			`vercel project add ${projectName} ${teamFlag}`,
			{ encoding: 'utf-8' }
		);

		// Vercel outputs to stderr: "> Success! Project <name> added (<team>) [time]"
		const output = stdout + stderr;

		// Now get the project ID using inspect command
		const projectInfo = await getProject(projectName, teamId);

		if (!projectInfo) {
			throw new Error('Project created but could not retrieve project info');
		}

		return projectInfo;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to create Vercel project: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Get Vercel API token from CLI config
 */
const getVercelToken = async (): Promise<string> => {
	const { homedir } = await import('node:os');
	const path = await import('node:path');
	const { readFile } = await import('node:fs/promises');

	const authPath = path.join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
	const content = await readFile(authPath, 'utf-8');
	const auth = JSON.parse(content);
	return auth.token;
};

/**
 * Make Vercel API request
 */
const vercelAPI = async (
	endpoint: string,
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
	body?: any
): Promise<any> => {
	const token = await getVercelToken();
	const url = `https://api.vercel.com${endpoint}`;

	const headers = [
		`-H "Authorization: Bearer ${token}"`,
		`-H "Content-Type: application/json"`
	].join(' ');

	const cmd = body
		? `curl -s -X ${method} "${url}" ${headers} -d '${JSON.stringify(body)}'`
		: `curl -s "${url}" ${headers}`;

	const { stdout } = await execAsync(cmd);
	return JSON.parse(stdout);
};

/**
 * Check GitHub integrations for the team
 * Note: This endpoint doesn't support teamId - returns all integrations for the authenticated user
 */
export const checkGitHubIntegration = async (): Promise<any> => {
	try {
		const endpoint = `/v1/integrations/git-namespaces?provider=github`;

		const result = await vercelAPI(endpoint, 'GET');
		console.log('🔍 GitHub integrations:', JSON.stringify(result, null, 2));
		return result;
	} catch (error) {
		console.error('Failed to check GitHub integration:', error);
		return null;
	}
};

/**
 * Find GitHub namespace ID for a given organization
 */
export const findGitHubNamespace = async (orgName: string): Promise<string | null> => {
	const integrations = await checkGitHubIntegration();

	if (!integrations || !Array.isArray(integrations)) {
		return null;
	}

	// Find the namespace that matches the org
	const namespace = integrations.find(
		(ns: any) => ns.name?.toLowerCase() === orgName.toLowerCase()
	);

	console.log('🔍 Found namespace for', orgName, ':', namespace);

	return namespace?.id?.toString() || null;
};

/**
 * Link GitHub repository to project using Vercel CLI
 * @throws Error if GitHub app not installed or other API error
 */
export const linkGitHub = async (
	projectId: string,
	org: string,
	repo: string,
	branch: string = 'main',
	teamId?: string
): Promise<void> => {
	try {
		console.log('🔗 Connecting GitHub repository:', { projectId, org, repo, branch });

		// Use vercel link to connect the project context, then git connect
		const teamFlag = teamId ? `--scope ${teamId}` : '';

		// Step 1: Link the project by ID so vercel git connect knows which project to use
		const { stdout: linkOut, stderr: linkErr } = await execAsync(
			`vercel link --project ${projectId} ${teamFlag} --yes`,
			{ encoding: 'utf-8' }
		);

		console.log('📝 Project linked:', linkOut + linkErr);

		// Step 2: Connect GitHub repository
		const gitUrl = `https://github.com/${org}/${repo}`;

		// Pipe 'y' to confirm connection (vercel git connect prompts for confirmation)
		const { stdout, stderr } = await execAsync(
			`echo y | vercel git connect ${gitUrl} ${teamFlag}`,
			{
				encoding: 'utf-8',
				timeout: 30000,  // 30 second timeout
				shell: '/bin/bash'
			}
		);

		const output = stdout + stderr;
		console.log('📝 Git connect output:', output);

		// Check for errors in output
		if (output.toLowerCase().includes('error:') || stderr.toLowerCase().includes('error:')) {
			throw new Error(output || 'Failed to connect GitHub repository');
		}

		console.log('✅ GitHub linked successfully');
	} catch (error) {
		if (error instanceof Error) {
			console.error('❌ Link error:', error.message);
			// Check for GitHub integration error
			if (error.message.includes('install') || error.message.includes('integration')) {
				throw new Error('GITHUB_NOT_INSTALLED');
			}
			throw error;
		}
		throw new Error('Failed to link GitHub repository');
	}
};

/**
 * Add environment variable to a project
 */
export const addEnvVar = async (
	projectName: string,
	key: string,
	value: string,
	environment: 'production' | 'preview' | 'development',
	teamId?: string
): Promise<void> => {
	try {
		const teamFlag = teamId ? `--scope ${teamId}` : '';
		await execAsync(
			`vercel env add ${key} ${environment} --project ${projectName} ${teamFlag} --yes`,
			{
				encoding: 'utf-8',
				input: value  // Pass value via stdin
			}
		);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to add environment variable ${key}: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Update project settings (root directory, framework, etc.)
 */
export const updateProjectSettings = async (
	projectId: string,
	teamId: string,
	settings: {
		rootDirectory?: string;
		buildCommand?: string | null;
		framework?: string | null;
		git?: {
			deploymentEnabled?: Record<string, boolean>;
		};
	}
): Promise<void> => {
	const endpoint = `/v10/projects/${projectId}?teamId=${teamId}`;

	const result = await vercelAPI(endpoint, 'PATCH', settings);

	if (result.error) {
		throw new Error(`Failed to update project settings: ${result.error.message}`);
	}
};

/**
 * Create custom environment for a project
 * Requires Pro/Enterprise plan (Pro: 1 custom env, Enterprise: 12)
 */
export const createCustomEnvironment = async (
	projectId: string,
	teamId: string,
	environmentName: string,
	trackedBranch: string
): Promise<string> => {
	const endpoint = `/v9/projects/${projectId}/custom-environments?teamId=${teamId}`;

	const result = await vercelAPI(endpoint, 'POST', {
		slug: environmentName.toLowerCase(),
		description: `${environmentName} environment`,
		branchMatcher: {
			type: 'equals',
			pattern: trackedBranch
		}
	});

	if (result.error) {
		throw new Error(`Failed to create custom environment: ${result.error.message}`);
	}

	return result.id;
};

/**
 * Deploy a project
 */
export const deploy = async (
	projectPath: string,
	production: boolean = false,
	teamId?: string
): Promise<{ url: string; deploymentId: string }> => {
	try {
		const teamFlag = teamId ? `--scope ${teamId}` : '';
		const prodFlag = production ? '--prod' : '';
		const { stdout } = await execAsync(
			`vercel deploy ${projectPath} ${prodFlag} ${teamFlag} --json`,
			{ encoding: 'utf-8' }
		);

		const data = JSON.parse(stdout.trim());
		return {
			url: data.url,
			deploymentId: data.id
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to deploy project: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Get project details using inspect command
 */
export const getProject = async (
	projectName: string,
	teamId?: string
): Promise<VercelProject | null> => {
	try {
		const teamFlag = teamId ? `--scope ${teamId}` : '';
		const { stdout, stderr } = await execAsync(
			`vercel project inspect ${projectName} ${teamFlag}`,
			{ encoding: 'utf-8' }
		);

		// Vercel outputs to stderr
		const output = stdout + stderr;

		// Parse the output to extract ID
		// Format:   ID				prj_U6d6BySFfAhIqIUqnB9wSU3hGhwx
		const idMatch = output.match(/ID\s+([a-zA-Z0-9_]+)/);
		const nameMatch = output.match(/Name\s+([^\s]+)/);

		if (!idMatch) {
			return null;
		}

		return {
			id: idMatch[1],
			name: nameMatch ? nameMatch[1] : projectName,
			framework: null
		};
	} catch (error) {
		return null;
	}
};
