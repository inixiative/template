import { execAsync } from './exec';

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
 * Check if a CLI is installed and get its version
 */
export const checkCLIAsync = async (
  name: string,
  command: string,
  versionFlag = '--version',
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
 * Check if user is logged into Infisical
 */
export const checkInfisicalSessionAsync = async (): Promise<InfisicalSession> => {
  try {
    const { stdout } = await execAsync('infisical user get token', { timeout: 10000 });
    const output = stdout.trim();

    const sessionMatch = output.match(/Session ID: (.+)/);
    const sessionId = sessionMatch?.[1];

    return {
      loggedIn: !!sessionId,
      user: sessionId ? `Session ${sessionId.substring(0, 8)}...` : undefined,
    };
  } catch (_error) {
    return {
      loggedIn: false,
      error: 'Not logged in',
    };
  }
};

/**
 * Check if user is logged into PlanetScale
 */
export const checkPlanetScaleSessionAsync = async (): Promise<InfisicalSession> => {
  try {
    const { stdout } = await execAsync('pscale auth check');
    const isLoggedIn = stdout.trim().includes('authenticated');

    return {
      loggedIn: isLoggedIn,
      user: isLoggedIn ? 'Authenticated' : undefined,
    };
  } catch (_error) {
    return {
      loggedIn: false,
      error: 'Not logged in',
    };
  }
};

/**
 * Check if user is logged into Vercel
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
  } catch (_error) {
    return {
      loggedIn: false,
      error: 'Not logged in',
    };
  }
};

/**
 * Check if user is logged into Railway
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
  } catch (_error) {
    return {
      loggedIn: false,
      error: 'Not logged in',
    };
  }
};

/**
 * Check if user is logged into GitHub CLI
 */
export const checkGitHubSessionAsync = async (): Promise<InfisicalSession> => {
  try {
    const { stdout } = await execAsync('gh auth status');
    const output = stdout.trim();

    const isLoggedIn = output.toLowerCase().includes('logged in');

    const userMatch = output.match(/Logged in to .+ as (.+?) \(/);
    const user = userMatch?.[1];

    return {
      loggedIn: isLoggedIn,
      user: user || (isLoggedIn ? 'Authenticated' : undefined),
    };
  } catch (error) {
    const errorOutput =
      error instanceof Error && 'stderr' in error ? String((error as { stderr: unknown }).stderr) : '';

    if (errorOutput.toLowerCase().includes('logged in')) {
      const userMatch = errorOutput.match(/Logged in to .+ as (.+?) \(/);
      const user = userMatch?.[1];
      return {
        loggedIn: true,
        user: user || 'Authenticated',
      };
    }

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
  } catch (_error) {
    return {
      loggedIn: false,
      error: 'Docker daemon not running',
    };
  }
};

const INSTALL_COMMANDS: Record<string, string> = {
  gh: 'brew install gh',
  infisical: 'brew install infisical/get-cli/infisical',
  pscale: 'brew install planetscale/tap/pscale',
  vercel: 'npm i -g vercel',
  railway: 'brew install railway',
  wrangler: 'npm i -g wrangler',
  docker: 'brew install --cask docker',
};

export const getInstallCommand = (cli: string): string => INSTALL_COMMANDS[cli] ?? `# install ${cli} manually`;

const SESSION_CHECKS: Record<string, () => Promise<InfisicalSession>> = {
  pscale: checkPlanetScaleSessionAsync,
  vercel: checkVercelSessionAsync,
  railway: checkRailwaySessionAsync,
  infisical: checkInfisicalSessionAsync,
  gh: checkGitHubSessionAsync,
  docker: checkDockerRunningAsync,
};

const LOGIN_COMMANDS: Record<string, string> = {
  pscale: 'pscale auth login',
  vercel: 'vercel login',
  railway: 'railway login',
  infisical: 'infisical login',
  gh: 'gh auth login',
  docker: 'open -a Docker  # then wait for the daemon to start',
};

export const checkProviderPrereq = async (
  cli: string,
): Promise<{ ok: true } | { ok: false; reason: string; fixCommand: string }> => {
  const status = await checkCLIAsync(cli, cli);
  if (!status.installed) {
    return { ok: false, reason: `${cli} CLI not installed`, fixCommand: getInstallCommand(cli) };
  }
  const sessionCheck = SESSION_CHECKS[cli];
  if (sessionCheck) {
    const session = await sessionCheck();
    if (!session.loggedIn) {
      return {
        ok: false,
        reason: `${cli} not authenticated (${session.error ?? 'no session'})`,
        fixCommand: LOGIN_COMMANDS[cli] ?? `${cli} login`,
      };
    }
  }
  return { ok: true };
};
