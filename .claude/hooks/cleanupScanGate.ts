import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Landing, landingsIn } from './bashMainCheckoutGuard';

type HookInput = {
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
};

const git = (directory: string, ...args: string[]) =>
  execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export const scanMarkerPath = (directory: string) =>
  resolve(directory, git(directory, 'rev-parse', '--git-path', 'cleanup-scan'));

const unscannedHead = (directory: string): string | undefined => {
  try {
    const head = git(directory, 'rev-parse', 'HEAD');
    const marker = scanMarkerPath(directory);
    const scanned = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : undefined;
    return scanned === head ? undefined : head;
  } catch {
    return undefined;
  }
};

const denial = (unscanned: { landing: Landing; head: string }[]) =>
  [
    'Run the cleanup scan before pushing: .claude/skills/cleanup-scan/SKILL.md',
    ...unscanned.map(({ landing, head }) => `  \`${landing.command}\` pushes ${head.slice(0, 8)}, which has not been scanned`),
    'Its last step records the scanned commit: git rev-parse HEAD > "$(git rev-parse --git-path cleanup-scan)"',
  ].join('\n');

export const gate = (input: HookInput): string | undefined => {
  const command = input.tool_input?.command;
  if (input.tool_name !== 'Bash' || !command || !input.cwd) return undefined;
  const unscanned = landingsIn(command, input.cwd)
    .filter((landing) => landing.subcommand === 'push' && landing.directory)
    .map((landing) => ({ landing, head: unscannedHead(landing.directory as string) }))
    .filter((push): push is { landing: Landing; head: string } => push.head !== undefined);
  return unscanned.length > 0 ? denial(unscanned) : undefined;
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
