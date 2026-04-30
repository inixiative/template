import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  checkCLIAsync,
  checkDockerRunningAsync,
  checkGitHubSessionAsync,
  checkInfisicalSessionAsync,
  checkPlanetScaleSessionAsync,
  checkRailwaySessionAsync,
  checkVercelSessionAsync,
  getInstallCommand,
} from '../utils/checkPrerequisites';

const LOGIN_COMMANDS: Record<string, string> = {
  gh: 'gh auth login',
  infisical: 'infisical login',
  pscale: 'pscale auth login',
  vercel: 'vercel login',
  railway: 'railway login',
  docker: 'open -a Docker  # then wait for the daemon to start',
};

type Failure = { label: string; reason: 'not-installed' | 'not-authed' | 'docker-down'; cliCommand: string };

type PrerequisitesProps = {
  onComplete: () => void;
};

type Status = 'pending' | 'checking' | 'success' | 'failed';

type Check = {
  status: Status;
  version?: string;
  user?: string;
};

// Default states - defined outside component
const DEFAULT_CHECK: () => Check = () => ({ status: 'pending' });

export const Prerequisites: React.FC<PrerequisitesProps> = ({ onComplete }) => {
  // Individual state variables for each check
  const [bunCLI, setBunCLI] = useState<Check>(DEFAULT_CHECK());
  const [gitCLI, setGitCLI] = useState<Check>(DEFAULT_CHECK());
  const [ghCLI, setGhCLI] = useState<Check>(DEFAULT_CHECK());
  const [dockerCLI, setDockerCLI] = useState<Check>(DEFAULT_CHECK());
  const [infisicalCLI, setInfisicalCLI] = useState<Check>(DEFAULT_CHECK());
  const [pscaleCLI, setPscaleCLI] = useState<Check>(DEFAULT_CHECK());
  const [vercelCLI, setVercelCLI] = useState<Check>(DEFAULT_CHECK());
  const [railwayCLI, setRailwayCLI] = useState<Check>(DEFAULT_CHECK());

  const [dockerRunning, setDockerRunning] = useState<Check>(DEFAULT_CHECK());
  const [infisicalSession, setInfisicalSession] = useState<Check>(DEFAULT_CHECK());
  const [pscaleSession, setPscaleSession] = useState<Check>(DEFAULT_CHECK());
  const [vercelSession, setVercelSession] = useState<Check>(DEFAULT_CHECK());
  const [railwaySession, setRailwaySession] = useState<Check>(DEFAULT_CHECK());
  const [ghSession, setGhSession] = useState<Check>(DEFAULT_CHECK());

  // Memoized completion checks
  const allDone = useMemo(
    () =>
      bunCLI.status !== 'pending' &&
      bunCLI.status !== 'checking' &&
      gitCLI.status !== 'pending' &&
      gitCLI.status !== 'checking' &&
      ghCLI.status !== 'pending' &&
      ghCLI.status !== 'checking' &&
      dockerCLI.status !== 'pending' &&
      dockerCLI.status !== 'checking' &&
      dockerRunning.status !== 'pending' &&
      dockerRunning.status !== 'checking' &&
      infisicalCLI.status !== 'pending' &&
      infisicalCLI.status !== 'checking' &&
      pscaleCLI.status !== 'pending' &&
      pscaleCLI.status !== 'checking' &&
      vercelCLI.status !== 'pending' &&
      vercelCLI.status !== 'checking' &&
      railwayCLI.status !== 'pending' &&
      railwayCLI.status !== 'checking' &&
      infisicalSession.status !== 'pending' &&
      infisicalSession.status !== 'checking' &&
      pscaleSession.status !== 'pending' &&
      pscaleSession.status !== 'checking' &&
      vercelSession.status !== 'pending' &&
      vercelSession.status !== 'checking' &&
      railwaySession.status !== 'pending' &&
      railwaySession.status !== 'checking' &&
      ghSession.status !== 'pending' &&
      ghSession.status !== 'checking',
    [
      bunCLI,
      gitCLI,
      ghCLI,
      dockerCLI,
      dockerRunning,
      infisicalCLI,
      pscaleCLI,
      vercelCLI,
      railwayCLI,
      infisicalSession,
      pscaleSession,
      vercelSession,
      railwaySession,
      ghSession,
    ],
  );

  // Core prereqs are required to start init at all. Provider-specific CLIs
  // (Railway, PlanetScale, Vercel, Wrangler) are checked lazily — when the
  // user actually selects that provider in Settings or enters a setup view.
  // This means a user picking "CF Pages + Railway Postgres" doesn't have to
  // install the Vercel or PlanetScale CLI just to get past prerequisites.
  // We still RUN the checks for visibility, but they don't block.
  const allPassed = useMemo(
    () =>
      bunCLI.status === 'success' &&
      gitCLI.status === 'success' &&
      ghCLI.status === 'success' &&
      dockerCLI.status === 'success' &&
      dockerRunning.status === 'success' &&
      infisicalCLI.status === 'success' &&
      infisicalSession.status === 'success' &&
      ghSession.status === 'success',
    [bunCLI, gitCLI, ghCLI, dockerCLI, dockerRunning, infisicalCLI, infisicalSession, ghSession],
  );

  // Fire off all checks on mount
  useEffect(() => {
    // Bun CLI
    setBunCLI({ status: 'checking' });
    checkCLIAsync('Bun', 'bun', '--version').then((result) => {
      setBunCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });
    });

    // Git CLI
    setGitCLI({ status: 'checking' });
    checkCLIAsync('Git', 'git', '--version').then((result) => {
      setGitCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });
    });

    // GitHub CLI → Session
    setGhCLI({ status: 'checking' });
    checkCLIAsync('GitHub CLI', 'gh', '--version').then(async (result) => {
      setGhCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });

      if (result.installed) {
        setGhSession({ status: 'checking' });
        const sessionResult = await checkGitHubSessionAsync();
        setGhSession({
          status: sessionResult.loggedIn ? 'success' : 'failed',
          user: sessionResult.user,
        });
      } else {
        setGhSession({ status: 'failed' });
      }
    });

    setDockerCLI({ status: 'checking' });
    checkCLIAsync('Docker', 'docker', '--version').then(async (result) => {
      setDockerCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });

      if (result.installed) {
        setDockerRunning({ status: 'checking' });
        const runningResult = await checkDockerRunningAsync();
        setDockerRunning({
          status: runningResult.loggedIn ? 'success' : 'failed',
          user: runningResult.user,
        });
      } else {
        setDockerRunning({ status: 'failed' });
      }
    });

    // Infisical CLI → Session
    setInfisicalCLI({ status: 'checking' });
    checkCLIAsync('Infisical CLI', 'infisical', '--version').then(async (result) => {
      setInfisicalCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });

      if (result.installed) {
        setInfisicalSession({ status: 'checking' });
        const sessionResult = await checkInfisicalSessionAsync();
        setInfisicalSession({
          status: sessionResult.loggedIn ? 'success' : 'failed',
          user: sessionResult.user,
        });
      } else {
        setInfisicalSession({ status: 'failed' });
      }
    });

    // PlanetScale CLI → Session
    setPscaleCLI({ status: 'checking' });
    checkCLIAsync('PlanetScale CLI', 'pscale', 'version').then(async (result) => {
      setPscaleCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });

      if (result.installed) {
        setPscaleSession({ status: 'checking' });
        const sessionResult = await checkPlanetScaleSessionAsync();
        setPscaleSession({
          status: sessionResult.loggedIn ? 'success' : 'failed',
          user: sessionResult.user,
        });
      } else {
        setPscaleSession({ status: 'failed' });
      }
    });

    // Vercel CLI → Session
    setVercelCLI({ status: 'checking' });
    checkCLIAsync('Vercel CLI', 'vercel', '--version').then(async (result) => {
      setVercelCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });

      if (result.installed) {
        setVercelSession({ status: 'checking' });
        const sessionResult = await checkVercelSessionAsync();
        setVercelSession({
          status: sessionResult.loggedIn ? 'success' : 'failed',
          user: sessionResult.user,
        });
      } else {
        setVercelSession({ status: 'failed' });
      }
    });

    // Railway CLI → Session
    setRailwayCLI({ status: 'checking' });
    checkCLIAsync('Railway CLI', 'railway', '--version').then(async (result) => {
      setRailwayCLI({
        status: result.installed ? 'success' : 'failed',
        version: result.version,
      });

      if (result.installed) {
        setRailwaySession({ status: 'checking' });
        const sessionResult = await checkRailwaySessionAsync();
        setRailwaySession({
          status: sessionResult.loggedIn ? 'success' : 'failed',
          user: sessionResult.user,
        });
      } else {
        setRailwaySession({ status: 'failed' });
      }
    });
  }, []);

  // Build a list of what failed, with the command to fix each
  const failures = useMemo<Failure[]>(() => {
    const out: Failure[] = [];
    const cliRow = (label: string, cliCommand: string, check: Check) => {
      if (check.status === 'failed') out.push({ label, cliCommand, reason: 'not-installed' });
    };
    const sessionRow = (label: string, cliCommand: string, cli: Check, sess: Check) => {
      // If CLI itself failed we already reported install above; only flag auth when CLI is OK but session isn't.
      if (cli.status === 'success' && sess.status === 'failed') out.push({ label, cliCommand, reason: 'not-authed' });
    };

    cliRow('Bun', 'bun', bunCLI);
    cliRow('Git', 'git', gitCLI);
    cliRow('GitHub CLI', 'gh', ghCLI);
    cliRow('Docker', 'docker', dockerCLI);
    cliRow('Infisical CLI', 'infisical', infisicalCLI);
    cliRow('PlanetScale CLI', 'pscale', pscaleCLI);
    cliRow('Vercel CLI', 'vercel', vercelCLI);
    cliRow('Railway CLI', 'railway', railwayCLI);

    if (dockerCLI.status === 'success' && dockerRunning.status === 'failed')
      out.push({ label: 'Docker daemon', cliCommand: 'docker', reason: 'docker-down' });
    sessionRow('GitHub', 'gh', ghCLI, ghSession);
    sessionRow('Infisical', 'infisical', infisicalCLI, infisicalSession);
    sessionRow('PlanetScale', 'pscale', pscaleCLI, pscaleSession);
    sessionRow('Vercel', 'vercel', vercelCLI, vercelSession);
    sessionRow('Railway', 'railway', railwayCLI, railwaySession);

    return out;
  }, [
    bunCLI,
    gitCLI,
    ghCLI,
    dockerCLI,
    dockerRunning,
    infisicalCLI,
    pscaleCLI,
    vercelCLI,
    railwayCLI,
    ghSession,
    infisicalSession,
    pscaleSession,
    vercelSession,
    railwaySession,
  ]);

  // Auto-advance only when everything passes; on failure, stay on screen until user dismisses.
  useEffect(() => {
    if (!allDone) return;
    if (!allPassed) return;
    const timer = setTimeout(() => onComplete(), 800);
    return () => clearTimeout(timer);
  }, [allDone, allPassed, onComplete]);

  // Pressing Enter / Esc / q after a failure exits cleanly with code 1 (so callers know it failed).
  useInput((input, key) => {
    if (!allDone || allPassed) return;
    if (key.return || key.escape || input === 'q') process.exit(1);
  });

  const renderCheck = (check: Check, name: string) => {
    if (check.status === 'pending') return <Text dimColor>− {name}</Text>;
    if (check.status === 'checking')
      return (
        <Text color="cyan">
          <Spinner type="dots" /> {name}
        </Text>
      );

    const icon = check.status === 'success' ? '✓' : '✗';
    const color = check.status === 'success' ? 'green' : 'red';

    return (
      <Text color={color}>
        {icon} {name}
        {check.version ? ` (${check.version})` : ''}
      </Text>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Prerequisites Check
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Required CLIs:</Text>
        <Box marginLeft={2}>{renderCheck(bunCLI, 'Bun')}</Box>
        <Box marginLeft={2}>{renderCheck(gitCLI, 'Git')}</Box>
        <Box marginLeft={2}>{renderCheck(ghCLI, 'GitHub CLI')}</Box>
        <Box marginLeft={2}>{renderCheck(dockerCLI, 'Docker')}</Box>
        <Box marginLeft={2}>{renderCheck(infisicalCLI, 'Infisical CLI')}</Box>
        <Box marginLeft={2}>{renderCheck(pscaleCLI, 'PlanetScale CLI')}</Box>
        <Box marginLeft={2}>{renderCheck(vercelCLI, 'Vercel CLI')}</Box>
        <Box marginLeft={2}>{renderCheck(railwayCLI, 'Railway CLI')}</Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Docker & Sessions:</Text>
        <Box marginLeft={2}>{renderCheck(dockerRunning, 'Docker Daemon')}</Box>
        <Box marginLeft={2}>{renderCheck(ghSession, 'GitHub')}</Box>
        <Box marginLeft={2}>{renderCheck(infisicalSession, 'Infisical')}</Box>
        <Box marginLeft={2}>{renderCheck(pscaleSession, 'PlanetScale')}</Box>
        <Box marginLeft={2}>{renderCheck(vercelSession, 'Vercel')}</Box>
        <Box marginLeft={2}>{renderCheck(railwaySession, 'Railway')}</Box>
      </Box>

      {allDone && allPassed && (
        <Box marginTop={1}>
          <Text color="green" bold>
            ✓ All prerequisites met!
          </Text>
        </Box>
      )}

      {allDone && !allPassed && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>
            ✗ Prerequisites failed — fix the items below and re-run `bun run init`:
          </Text>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {failures.map((f) => {
              const cmd =
                f.reason === 'not-installed'
                  ? getInstallCommand(f.cliCommand)
                  : (LOGIN_COMMANDS[f.cliCommand] ?? `# fix ${f.cliCommand} manually`);
              const heading =
                f.reason === 'not-installed'
                  ? `${f.label} — not installed`
                  : f.reason === 'docker-down'
                    ? `${f.label} — daemon not running`
                    : `${f.label} — not authenticated`;
              return (
                <Box key={`${f.label}-${f.reason}`} flexDirection="column" marginBottom={1}>
                  <Text color="red">• {heading}</Text>
                  <Box marginLeft={2}>
                    <Text color="cyan">{cmd}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter / Esc / q to exit.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
