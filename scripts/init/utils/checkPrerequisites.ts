import { execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type PrerequisiteStatus = {
	name: string;
	command: string;
	installed: boolean;
	version?: string;
	error?: string;
};

export type InfisicalSession = {
	loggedIn: boolean;
	user?: string;
	error?: string;
};

/**
 * Check if a CLI is installed and get its version (sync version)
 */
export const checkCLI = (name: string, command: string, versionFlag = '--version'): PrerequisiteStatus => {
	try {
		const output = execSync(`${command} ${versionFlag}`, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		// Extract version from output (first line usually has version)
		const version = output.split('\n')[0];

		return {
			name,
			command,
			installed: true,
			version,
		};
	} catch (error) {
		return {
			name,
			command,
			installed: false,
			error: error instanceof Error ? error.message : 'Not found',
		};
	}
};

/**
 * Check if a CLI is installed and get its version (async version for parallel execution)
 */
export const checkCLIAsync = async (
	name: string,
	command: string,
	versionFlag = '--version'
): Promise<PrerequisiteStatus> => {
	try {
		const { stdout } = await execAsync(`${command} ${versionFlag}`);
		const version = stdout.trim().split('\n')[0];

		return {
			name,
			command,
			installed: true,
			version,
		};
	} catch (error) {
		return {
			name,
			command,
			installed: false,
			error: error instanceof Error ? error.message : 'Not found',
		};
	}
};

/**
 * Check if user is logged into Infisical (sync version)
 */
export const checkInfisicalSession = (): InfisicalSession => {
	try {
		const output = execSync('infisical user get token', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		// Parse output to get session ID
		const sessionMatch = output.match(/Session ID: (.+)/);
		const sessionId = sessionMatch?.[1];

		return {
			loggedIn: !!sessionId,
			user: sessionId ? `Session ${sessionId.substring(0, 8)}...` : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into Infisical (async version)
 */
export const checkInfisicalSessionAsync = async (): Promise<InfisicalSession> => {
	try {
		const { stdout } = await execAsync('infisical user get token');
		const output = stdout.trim();

		const sessionMatch = output.match(/Session ID: (.+)/);
		const sessionId = sessionMatch?.[1];

		return {
			loggedIn: !!sessionId,
			user: sessionId ? `Session ${sessionId.substring(0, 8)}...` : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into PlanetScale (sync version)
 */
export const checkPlanetScaleSession = (): InfisicalSession => {
	try {
		const output = execSync('pscale auth check', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		// Check if authenticated
		const isLoggedIn = output.includes('authenticated');

		return {
			loggedIn: isLoggedIn,
			user: isLoggedIn ? 'Authenticated' : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into PlanetScale (async version)
 */
export const checkPlanetScaleSessionAsync = async (): Promise<InfisicalSession> => {
	try {
		const { stdout } = await execAsync('pscale auth check');
		const isLoggedIn = stdout.trim().includes('authenticated');

		return {
			loggedIn: isLoggedIn,
			user: isLoggedIn ? 'Authenticated' : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into Vercel (sync version)
 */
export const checkVercelSession = (): InfisicalSession => {
	try {
		const output = execSync('vercel whoami', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		// Output is the username if logged in
		const isLoggedIn = output.length > 0 && !output.toLowerCase().includes('error');

		return {
			loggedIn: isLoggedIn,
			user: isLoggedIn ? output : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into Vercel (async version)
 */
export const checkVercelSessionAsync = async (): Promise<InfisicalSession> => {
	try {
		const { stdout } = await execAsync('vercel whoami');
		const output = stdout.trim();
		const isLoggedIn = output.length > 0 && !output.toLowerCase().includes('error');

		return {
			loggedIn: isLoggedIn,
			user: isLoggedIn ? output : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into Railway (sync version)
 */
export const checkRailwaySession = (): InfisicalSession => {
	try {
		// Railway whoami returns user info if logged in
		const output = execSync('railway whoami', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		// Output contains user info if logged in
		const isLoggedIn = output.length > 0 && !output.toLowerCase().includes('not logged in');

		return {
			loggedIn: isLoggedIn,
			user: isLoggedIn ? output.split('\n')[0] : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if user is logged into Railway (async version)
 */
export const checkRailwaySessionAsync = async (): Promise<InfisicalSession> => {
	try {
		const { stdout } = await execAsync('railway whoami');
		const output = stdout.trim();
		const isLoggedIn = output.length > 0 && !output.toLowerCase().includes('not logged in');

		return {
			loggedIn: isLoggedIn,
			user: isLoggedIn ? output.split('\n')[0] : undefined,
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Not logged in',
		};
	}
};

/**
 * Check if Docker daemon is running
 */
export const checkDockerRunningAsync = async (): Promise<InfisicalSession> => {
	try {
		await execAsync('docker info');
		return {
			loggedIn: true,
			user: 'Running',
		};
	} catch (error) {
		return {
			loggedIn: false,
			error: 'Docker daemon not running',
		};
	}
};

/**
 * Check all prerequisites
 */
export const checkAllPrerequisites = () => {
	const clis: PrerequisiteStatus[] = [
		checkCLI('Git', 'git'),
		checkCLI('GitHub CLI', 'gh'),
		checkCLI('Bun', 'bun'),
		checkCLI('Infisical', 'infisical'),
		checkCLI('Vercel', 'vercel'),
		checkCLI('PlanetScale', 'pscale', 'version'), // pscale uses 'version' not '--version'
		checkCLI('Docker', 'docker'), // Optional for local dev
	];

	const infisicalSession = checkInfisicalSession();

	const allInstalled = clis.every((cli) => cli.installed);
	const canProceed = allInstalled && infisicalSession.loggedIn;

	return {
		clis,
		infisicalSession,
		allInstalled,
		canProceed,
	};
};

/**
 * Get installation command based on OS
 */
export const getInstallCommand = (cliCommand: string): string => {
	const installCommands: Record<string, string> = {
		bun: 'curl -fsSL https://bun.sh/install | bash',
		git: 'brew install git',
		gh: 'brew install gh',
		infisical: 'brew install infisical/infisical-cli/infisical',
		vercel: 'npm install -g vercel',
		pscale: 'brew install planetscale/tap/pscale',
		railway: 'brew install railway',
		docker: 'brew install --cask docker',
	};

	return installCommands[cliCommand] || `# Install ${cliCommand} manually`;
};
