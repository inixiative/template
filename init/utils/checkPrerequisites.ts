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

/**
 * Check all prerequisites (async)
 */
export const checkAllPrerequisitesAsync = async () => {
  const clis = await Promise.all([
    checkCLIAsync('Git', 'git'),
    checkCLIAsync('GitHub CLI', 'gh'),
    checkCLIAsync('Bun', 'bun'),
    checkCLIAsync('Infisical', 'infisical'),
    checkCLIAsync('Vercel', 'vercel'),
    checkCLIAsync('PlanetScale', 'pscale', 'version'),
    checkCLIAsync('Docker', 'docker'),
  ]);

  const infisicalSession = await checkInfisicalSessionAsync();

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
