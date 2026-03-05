import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectConfig } from '../utils/getProjectConfig';
import {
	updateConfigField,
	setProgressComplete,
	isProgressComplete,
	setConfigError,
	clearConfigError,
} from '../utils/configHelpers';
import {
	createImageService,
	setEnvironmentVariables,
	getLatestDeployment,
	triggerServiceDeployment,
	getServiceDomain,
} from '../api/railway';
import { checkHealth, initializeVault, generateTeamToken } from '../api/muninndb';
import { setSecret, getSecret } from './infisicalSetup';
import { retryWithTimeout } from '../utils/retry';

const execAsync = promisify(exec);

const MUNINN_IMAGE = 'ghcr.io/scrypster/muninndb:latest';

/**
 * Read the git user email for actor identity.
 * Returns empty string if not configured.
 */
export const getGitUserEmail = async (): Promise<string> => {
	try {
		const { stdout } = await execAsync('git config user.email', { encoding: 'utf-8' });
		return stdout.trim();
	} catch {
		return '';
	}
};

/**
 * Provision MuninnDB shared memory vault on Railway (staging environment).
 *
 * Steps:
 *   1. createService    — create Railway image service from ghcr.io/scrypster/muninndb:latest
 *   2. configureService — set MUNINNDB_DATA, MUNINN_LOCAL_EMBED, PORT env vars
 *   3. deployService    — trigger deployment, wait for public domain
 *   4. waitForHealth    — retry GET /health until 200 (max 5 min)
 *   5. storeSecrets     — generate team token, store MUNINN_SHARED_URL + MUNINN_TEAM_TOKEN in Infisical
 *   6. seedTeamVault    — POST seed engram to 'team' vault
 *
 * Each step is guarded by isProgressComplete() — safe to resume after failure.
 */
export const setupMuninnShared = async (
	projectId: string,
	stagingEnvironmentId: string,
	infisicalProjectId: string,
	onStepComplete?: () => Promise<void>
): Promise<void> => {
	try {
		await clearConfigError('muninndb');

		const config = await getProjectConfig();
		let serviceId = config.muninndb?.railwayServiceId || '';
		let serviceUrl = config.muninndb?.serviceUrl || '';

		// Step 1: Create Railway image service
		if (!(await isProgressComplete('muninndb', 'createService'))) {
			if (!serviceId) {
				const result = await createImageService(
					projectId,
					stagingEnvironmentId,
					'muninndb',
					MUNINN_IMAGE
				);
				serviceId = result.serviceId;
				await updateConfigField('muninndb', 'railwayServiceId', serviceId);
			}
			await setProgressComplete('muninndb', 'createService');
			await onStepComplete?.();
		}

		// Step 2: Configure environment variables
		if (!(await isProgressComplete('muninndb', 'configureService'))) {
			await setEnvironmentVariables(serviceId, stagingEnvironmentId, {
				MUNINNDB_DATA: '/data',
				MUNINN_LOCAL_EMBED: '1',
				PORT: '8750',
			});
			await setProgressComplete('muninndb', 'configureService');
			await onStepComplete?.();
		}

		// Step 3: Deploy service and capture public URL
		if (!(await isProgressComplete('muninndb', 'deployService'))) {
			const latestDeployment = await getLatestDeployment(serviceId, stagingEnvironmentId);
			if (!latestDeployment) {
				await triggerServiceDeployment(serviceId, stagingEnvironmentId);
			}

			// Wait for Railway to assign a public domain
			serviceUrl = await retryWithTimeout(
				async () => {
					const url = await getServiceDomain(serviceId, stagingEnvironmentId);
					if (!url) throw new Error('Service domain not yet available');
					return url;
				},
				{
					maxRetries: 30,
					delayMs: 5000,
					retryCondition: (error) => error.message.includes('not yet available'),
					timeoutMessage: 'Timed out waiting for Muninn service domain after 2.5 minutes',
				}
			);

			await updateConfigField('muninndb', 'serviceUrl', serviceUrl);
			await setProgressComplete('muninndb', 'deployService');
			await onStepComplete?.();
		}

		// Step 4: Wait for health
		if (!(await isProgressComplete('muninndb', 'waitForHealth'))) {
			if (!serviceUrl) {
				const latestConfig = await getProjectConfig();
				serviceUrl = latestConfig.muninndb?.serviceUrl || '';
				if (!serviceUrl) {
					throw new Error('Muninn service URL missing — complete deployService step first.');
				}
			}

			await retryWithTimeout(
				async () => {
					const healthy = await checkHealth(serviceUrl);
					if (!healthy) throw new Error('Muninn health check returned non-200');
				},
				{
					maxRetries: 60,
					delayMs: 5000,
					retryCondition: () => true,
					timeoutMessage: 'Muninn health check timed out after 5 minutes',
				}
			);

			await setProgressComplete('muninndb', 'waitForHealth');
			await onStepComplete?.();
		}

		// Step 5: Generate team token and store secrets in Infisical
		if (!(await isProgressComplete('muninndb', 'storeSecrets'))) {
			if (!serviceUrl) {
				const latestConfig = await getProjectConfig();
				serviceUrl = latestConfig.muninndb?.serviceUrl || '';
			}

			// generateTeamToken falls back to empty string if admin key endpoint not available
			const teamToken = await generateTeamToken(serviceUrl, '');
			const mcpUrl = `${serviceUrl}/mcp`;

			setSecret(infisicalProjectId, 'staging', 'MUNINN_SHARED_URL', mcpUrl, '/api');
			if (teamToken) {
				setSecret(infisicalProjectId, 'staging', 'MUNINN_TEAM_TOKEN', teamToken, '/api');
			}

			await setProgressComplete('muninndb', 'storeSecrets');
			await onStepComplete?.();
		}

		// Step 6: Seed team vault (best-effort — failure does not block setup)
		if (!(await isProgressComplete('muninndb', 'seedTeamVault'))) {
			if (!serviceUrl) {
				const latestConfig = await getProjectConfig();
				serviceUrl = latestConfig.muninndb?.serviceUrl || '';
			}

			let teamToken = '';
			try {
				teamToken = getSecret('MUNINN_TEAM_TOKEN', {
					projectId: infisicalProjectId,
					environment: 'staging',
					path: '/api',
				}) || '';
			} catch {
				// Secret may not exist if Railway instance needs no auth
			}

			try {
				await initializeVault(`${serviceUrl}/mcp`, teamToken, 'team');
			} catch {
				// Non-fatal: vault creation is implicit on first engram write
				// Mark as complete anyway so setup can proceed
			}

			await setProgressComplete('muninndb', 'seedTeamVault');
			await onStepComplete?.();
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await setConfigError('muninndb', errorMsg);
		throw error;
	}
};

/**
 * Write per-developer actor memory files:
 *   - .claude/memory.local.json  (gitignored, actor identity + vault URLs)
 *   - .mcp.json                  (gitignored, MCP server config for Claude Code)
 *
 * Always overwrites with latest URLs (safe to call on Railway re-provision).
 */
export const ensureLocalActorMemory = async (
	email: string,
	sharedMcpUrl: string,
	sharedVault: string,
	teamToken: string
): Promise<void> => {
	const actorId = email
		.toLowerCase()
		.replace(/[@.]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	const memory = {
		actorId,
		email,
		personalVault: actorId,
		personalMcpUrl: 'http://localhost:8750/mcp',
		sharedMcpUrl,
		sharedVault,
		updatedAt: new Date().toISOString(),
	};

	const claudeDir = join(process.cwd(), '.claude');
	mkdirSync(claudeDir, { recursive: true });

	writeFileSync(
		join(claudeDir, 'memory.local.json'),
		JSON.stringify(memory, null, '\t'),
		'utf-8'
	);

	const mcpConfig: Record<string, unknown> = {
		mcpServers: {
			'muninndb-local': {
				type: 'http',
				url: 'http://localhost:8750/mcp',
			},
			...(sharedMcpUrl
				? {
						'muninndb-team': {
							type: 'http',
							url: sharedMcpUrl,
							...(teamToken ? { headers: { Authorization: `Bearer ${teamToken}` } } : {}),
						},
					}
				: {}),
		},
	};

	writeFileSync(
		join(process.cwd(), '.mcp.json'),
		JSON.stringify(mcpConfig, null, '\t'),
		'utf-8'
	);
};
