import { getProjectConfig, writeProjectConfig } from './getProjectConfig';

export type ProgressSection = 'project' | 'infisical' | 'planetscale' | 'railway' | 'vercel';

export type InfisicalAction =
	| 'selectOrg'
	| 'createProject'
	| 'renameEnv'
	| 'createApps'
	| 'setInheritance'
	| 'ensureApiAuthSecrets';
export type ProjectAction = 'renameOrg' | 'renameProject' | 'setup';
export type PlanetScaleAction =
	| 'selectOrg'
	| 'selectRegion'
	| 'createToken'
	| 'setInfisicalToken'
	| 'createDB'
	| 'renameProductionBranch'
	| 'createStagingBranch'
	| 'createPasswords'
	| 'storeConnectionStrings'
	| 'initMigrationTable'
	| 'configureDB';

export type RailwayAction =
	| 'selectWorkspace'
	| 'storeRailwayToken'
	| 'createProject'
	| 'provisionRedis'
	| 'storeRedisUrl'
	| 'setupInfisicalIntegration'
	| 'deployApi'
	| 'storeApiUrl'
	| 'deployWorker'
	| 'verifyDeployment';

export type VercelAction =
	| 'selectTeam'
	| 'createWebProject'
	| 'createAdminProject'
	| 'createSuperadminProject'
	| 'linkGitHub'
	| 'configureEnvVars'
	| 'deployProduction';

export type ProgressActions = {
	project: ProjectAction;
	infisical: InfisicalAction;
	planetscale: PlanetScaleAction;
	railway: RailwayAction;
	vercel: VercelAction;
};

/**
 * Mark a step as complete
 */
export const markComplete = async <S extends ProgressSection>(section: S, action: ProgressActions[S]): Promise<void> => {
	const config = await getProjectConfig();
	(config[section] as any).progress[action] = true;
	await writeProjectConfig(config);
};

/**
 * Check if a step is complete
 */
export const isComplete = async <S extends ProgressSection>(
	section: S,
	action: ProgressActions[S]
): Promise<boolean> => {
	const config = await getProjectConfig();
	return (config[section] as any).progress[action] === true;
};

/**
 * Clear all progress for a section (set all flags to false)
 */
export const clearProgress = async (section: ProgressSection): Promise<void> => {
	const config = await getProjectConfig();
	const progress = (config[section] as any).progress;
	for (const key in progress) {
		progress[key] = false;
	}
	await writeProjectConfig(config);
};

/**
 * Set error message for a section
 */
export const setError = async (section: ProgressSection, message: string): Promise<void> => {
	const config = await getProjectConfig();
	(config[section] as any).error = message;
	await writeProjectConfig(config);
};

/**
 * Clear error for a section
 */
export const clearError = async (section: ProgressSection): Promise<void> => {
	await setError(section, '');
};
