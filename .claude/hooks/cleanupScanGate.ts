import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Landing, landingsIn } from './bashMainCheckoutGuard';

type HookInput = {
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
};

const PUSH_OPTIONS_WITH_VALUE = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec']);

const git = (directory: string, ...args: string[]) =>
  execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const succeeds = (directory: string, ...args: string[]) => {
  try {
    git(directory, ...args);
    return true;
  } catch {
    return false;
  }
};

export const scanMarkerPath = (directory: string) =>
  resolve(directory, git(directory, 'rev-parse', '--git-path', 'cleanup-scan'));

const pushedSources = (args: string[]): string[] => {
  const flags: string[] = [];
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('-')) positionals.push(args[i]);
    else if (PUSH_OPTIONS_WITH_VALUE.has(args[i])) i += 1;
    else flags.push(args[i]);
  }
  if (flags.some((flag) => flag === '-d' || flag === '--delete')) return [];
  if (flags.some((flag) => flag === '--all' || flag === '--mirror' || flag === '--branches')) return ['--branches'];
  const refspecs = positionals.slice(1);
  if (refspecs.length === 0) return flags.includes('--tags') ? [] : ['HEAD'];
  return refspecs.map((refspec) => refspec.replace(/^\+/, '').split(':')[0]).filter(Boolean);
};

const commitsOf = (directory: string, source: string): string[] =>
  source === '--branches'
    ? git(directory, 'for-each-ref', '--format=%(objectname)', 'refs/heads').split('\n').filter(Boolean)
    : [git(directory, 'rev-parse', '--verify', `${source}^{commit}`)];

const unscannedCommits = (landing: Landing): string[] => {
  const directory = landing.directory as string;
  try {
    const marker = scanMarkerPath(directory);
    const scanned = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : undefined;
    return pushedSources(landing.args ?? [])
      .flatMap((source) => commitsOf(directory, source))
      .filter(
        (commit) =>
          !(scanned && succeeds(directory, 'merge-base', '--is-ancestor', commit, scanned)) &&
          git(directory, 'branch', '-r', '--contains', commit) === '',
      );
  } catch {
    return [];
  }
};

const SCAN = 'Run the cleanup scan before pushing: .claude/skills/cleanup-scan/SKILL.md';
const RECORD = 'Its last step records the scanned commit: git rev-parse HEAD > "$(git rev-parse --git-path cleanup-scan)"';

export const gate = (input: HookInput): string | undefined => {
  const command = input.tool_input?.command;
  if (input.tool_name !== 'Bash' || !command || !input.cwd) return undefined;
  const landings = landingsIn(command, input.cwd);
  const reasons = landings.flatMap((landing, index) => {
    if (landing.subcommand !== 'push') return [];
    if (!landing.directory)
      return [`  \`${landing.command}\`: cannot tell which checkout this pushes from; name the directory literally`];
    if (landings.slice(0, index).some((earlier) => earlier.subcommand && earlier.subcommand !== 'push' && earlier.directory === landing.directory))
      return [`  \`${landing.command}\` follows a commit in the same call; push in its own call after the scan`];
    return unscannedCommits(landing).map(
      (commit) => `  \`${landing.command}\` pushes ${commit.slice(0, 8)}, which has not been scanned`,
    );
  });
  return reasons.length > 0 ? [SCAN, ...reasons, RECORD].join('\n') : undefined;
};

const main = () => {
  const reason = gate(JSON.parse(readFileSync(0, 'utf8')) as HookInput);
  if (!reason) return;
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    })}\n`,
  );
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`cleanupScanGate: failed open: ${(error as Error).message}`);
  }
}
