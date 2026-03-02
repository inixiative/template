export const projectConfig = {
	"project": {
		"name": "",
		"organization": "",
		"progress": {
			"renameOrg": false,
			"renameProject": false,
			"setup": false
		}
	},
	"infisical": {
		"projectId": "",
		"organizationId": "",
		"organizationSlug": "",
		"projectSlug": "",
		"configProjectName": "",
		"progress": {
			"selectOrg": false,
			"createProject": false,
			"renameEnv": false,
			"createApps": false,
			"setInheritance": false
		},
		"error": ""
	},
	"planetscale": {
		"organization": "",
		"region": "",
		"database": "",
		"tokenId": "",
		"configProjectName": "",
		"progress": {
			"selectOrg": false,
			"selectRegion": false,
			"createToken": false,
			"setInfisicalToken": false,
			"createDB": false,
			"renameProductionBranch": false,
			"createStagingBranch": false,
			"createPasswords": false,
			"storeConnectionStrings": false,
			"initMigrationTable": false,
			"configureDB": false
		},
		"error": ""
	},
	"railway": {
		"projectId": "",
		"workspaceId": "",
		"prodEnvironmentId": "",
		"stagingEnvironmentId": "",
		"prodApiServiceId": "",
		"stagingApiServiceId": "",
		"prodWorkerServiceId": "",
		"stagingWorkerServiceId": "",
		"prodRedisServiceId": "",
		"stagingRedisServiceId": "",
		"prodRedisVolumeId": "",
		"stagingRedisVolumeId": "",
		"configProjectName": "",
		"progress": {
			"selectWorkspace": false,
			"storeRailwayToken": false,
			"createProject": false,
			"renameProductionEnv": false,
			"createStagingEnv": false,
			"createRedisProd": false,
			"renameRedisProd": false,
			"renameRedisProdVolume": false,
			"createRedisStaging": false,
			"renameRedisStaging": false,
			"renameRedisStagingVolume": false,
			"storeRedisUrl": false,
			"createInfisicalConnection": false,
			"createInfisicalSyncProd": false,
			"createInfisicalSyncStaging": false,
			"promptedForGithub": true,
			"createApiProd": false,
			"connectApiProdGithub": false,
			"createApiStaging": false,
			"connectApiStagingGithub": false,
			"storeApiUrl": false,
			"createWorkerProd": false,
			"connectWorkerProdGithub": false,
			"createWorkerStaging": false,
			"connectWorkerStagingGithub": false,
			"verifyDeployment": false
		},
		"error": "Railway GraphQL error: ServiceInstance not found"
	}
} as const;

export type ProjectConfig = typeof projectConfig;
