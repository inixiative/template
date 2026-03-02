import { join } from 'node:path';

export type ProjectConfig = {
	project: {
		name: string;
		organization: string;
		progress: {
			renameOrg: boolean;
			renameProject: boolean;
			setup: boolean;
		};
	};
	infisical: {
		projectId: string;
		organizationId: string;
		organizationSlug: string;
		projectSlug: string;
		configProjectName: string;
			progress: {
				selectOrg: boolean;
				createProject: boolean;
				renameEnv: boolean;
				createApps: boolean;
				setInheritance: boolean;
				ensureApiAuthSecrets: boolean;
			};
		error: string;
	};
	planetscale: {
		organization: string;
		region: string;
		database: string;
		tokenId: string;
		configProjectName: string;
		progress: {
			selectOrg: boolean;
			selectRegion: boolean;
			createToken: boolean;
			setInfisicalToken: boolean;
			createDB: boolean;
			renameProductionBranch: boolean;
			createStagingBranch: boolean;
			createPasswords: boolean;
			storeConnectionStrings: boolean;
			initMigrationTable: boolean;
			configureDB: boolean;
		};
		error: string;
	};
	railway: {
		projectId: string;
		workspaceId: string;
		prodEnvironmentId: string;
		stagingEnvironmentId: string;
		prodApiServiceId: string;
		stagingApiServiceId: string;
		prodWorkerServiceId: string;
		stagingWorkerServiceId: string;
		prodRedisServiceId: string;
		stagingRedisServiceId: string;
		prodRedisVolumeId: string;
		stagingRedisVolumeId: string;
		configProjectName: string;
		progress: {
			selectWorkspace: boolean;
			storeRailwayToken: boolean;
			createProject: boolean;
			renameProductionEnv: boolean;
			createStagingEnv: boolean;
			createRedisProd: boolean;
			renameRedisProd: boolean;
			renameRedisProdVolume: boolean;
			createRedisStaging: boolean;
			renameRedisStaging: boolean;
			renameRedisStagingVolume: boolean;
			storeRedisUrl: boolean;
			createInfisicalConnection: boolean;
			promptedForGithub: boolean;
			createApiProd: boolean;
			createInfisicalSyncProd: boolean;
			connectApiProdGithub: boolean;
			createApiStaging: boolean;
			createInfisicalSyncStagingApi: boolean;
			connectApiStagingGithub: boolean;
			storeApiUrl: boolean;
			createWorkerProd: boolean;
			connectWorkerProdGithub: boolean;
			createWorkerStaging: boolean;
			createInfisicalSyncStagingWorker: boolean;
			connectWorkerStagingGithub: boolean;
			verifyDeployment: boolean;
		};
		error: string;
	};
	vercel: {
		teamId: string;
		teamName: string;
		webProjectId: string;
		adminProjectId: string;
		superadminProjectId: string;
		configProjectName: string;
		progress: {
			selectTeam: boolean;
			promptedForGithub: boolean;
			// Web app
			createWebProject: boolean;
			configureWebRootDirectory: boolean;
			createWebStagingEnvironment: boolean;
			linkWebGitHub: boolean;
			configureWebBranches: boolean;
			createWebInfisicalSyncProd: boolean;
			createWebInfisicalSyncStaging: boolean;
			createWebInfisicalSyncPreview: boolean;
			// Admin app
			createAdminProject: boolean;
			configureAdminRootDirectory: boolean;
			createAdminStagingEnvironment: boolean;
			linkAdminGitHub: boolean;
			configureAdminBranches: boolean;
			createAdminInfisicalSyncProd: boolean;
			createAdminInfisicalSyncStaging: boolean;
			createAdminInfisicalSyncPreview: boolean;
			// Superadmin app
			createSuperadminProject: boolean;
			configureSuperadminRootDirectory: boolean;
			createSuperadminStagingEnvironment: boolean;
			linkSuperadminGitHub: boolean;
			configureSuperadminBranches: boolean;
			createSuperadminInfisicalSyncProd: boolean;
			createSuperadminInfisicalSyncStaging: boolean;
			createSuperadminInfisicalSyncPreview: boolean;
			// Final
			deployProduction: boolean;
		};
		error: string;
	};
};

/**
 * Get the project configuration based on USE_INTERNAL_CONFIG env var
 *
 * - USE_INTERNAL_CONFIG=true -> project.config.template-internal.ts
 * - Otherwise -> project.config.ts
 */
export const getProjectConfig = async (): Promise<ProjectConfig> => {
	const useInternal = process.env.USE_INTERNAL_CONFIG === 'true';
	const configFile = useInternal ? 'project.config.template-internal.ts' : 'project.config.ts';
	const configPath = join(process.cwd(), configFile);

	try {
		// Bust import cache with timestamp to get fresh config
		const module = await import(configPath + '?t=' + Date.now());
		return module.projectConfig;
	} catch (error) {
		throw new Error(
			`Failed to load project config from ${configFile}. ` +
			`Make sure the file exists and exports 'projectConfig'. ` +
			`Error: ${error instanceof Error ? error.message : String(error)}`
		);
	}
};

/**
 * Get the target config file path (for writing updates)
 */
export const getProjectConfigPath = (): string => {
	const useInternal = process.env.USE_INTERNAL_CONFIG === 'true';
	const configFile = useInternal ? 'project.config.template-internal.ts' : 'project.config.ts';
	return join(process.cwd(), configFile);
};

/**
 * Write the project configuration back to file
 */
export const writeProjectConfig = async (config: ProjectConfig): Promise<void> => {
	const { writeFileSync } = await import('node:fs');
	const configPath = getProjectConfigPath();

	// Stringify with tabs for indentation
	const configJson = JSON.stringify(config, null, '\t');

	// Wrap in TypeScript boilerplate
	const content = `export const projectConfig = ${configJson} as const;\n\nexport type ProjectConfig = typeof projectConfig;\n`;

	writeFileSync(configPath, content, 'utf-8');
};
