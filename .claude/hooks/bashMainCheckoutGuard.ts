import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

type HookInput = {
  hook_event_name?: string;
  session_id?: string;
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
};

const SEPARATOR = String.raw`(?:^|[;&|(]\s*)`;
const GLOBAL_OPTIONS = String.raw`(?:\s+-{1,2}[\w-]+(?:[= ]\S+)?)*`;
const RUNNER = String.raw`(?:(?:bunx|bun\s+run${GLOBAL_OPTIONS}|bun\s+x|npx|sudo|time|env(?:\s+\w+=\S*)*)\s+)*`;
const PATH_TOKEN = String.raw`(?:"([^"]+)"|'([^']+)'|([^\s;&|)]+))`;

export const MUTATING = new RegExp(
  `${SEPARATOR}${RUNNER}(?:` +
    String.raw`bun${GLOBAL_OPTIONS}\s+(?:add|remove|update)\b` +
    `|` +
    String.raw`git${GLOBAL_OPTIONS}\s+(?:commit|push|merge|rebase|cherry-pick|worktree\s+(?:add|remove|move|prune))\b` +
    `|` +
    String.raw`prisma\s+migrate\s+dev\b` +
    `|` +
    String.raw`db:migrate\b` +
    `)`,
);

const LEADING_CD = new RegExp(String.raw`^\s*\(?\s*(?:cd|pushd)\s+${PATH_TOKEN}`);
const GIT_C = new RegExp(String.raw`\bgit(?:\s+-{1,2}[\w-]+(?:[= ]\S+)?)*\s+-C\s+${PATH_TOKEN}`, 'g');

const pathFromMatch = (match: RegExpMatchArray) => match[1] ?? match[2] ?? match[3];

const explicitTargets = (command: string): string[] => {
  const targets: string[] = [];
  const leading = command.match(LEADING_CD);
  if (leading) targets.push(pathFromMatch(leading));
  for (const match of command.matchAll(GIT_C)) targets.push(pathFromMatch(match));
  return targets;
};

type Checkout = { root: string; isMain: boolean };

const linkedGitdir = (dotGitFile: string, root: string): string | undefined => {
  const gitdir = readFileSync(dotGitFile, 'utf8')
    .match(/^gitdir:\s*(.+)$/m)?.[1]
    ?.trim();
  return gitdir ? resolve(root, gitdir) : undefined;
};

const findCheckout = (from: string): Checkout | undefined => {
  let dir = resolve(from);
  while (true) {
    const dotGit = join(dir, '.git');
    if (existsSync(dotGit)) {
      if (statSync(dotGit).isDirectory()) return { root: dir, isMain: true };
      const gitdir = linkedGitdir(dotGit, dir);
      return gitdir && existsSync(gitdir) ? { root: dir, isMain: false } : undefined;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
};

const namesCheckoutDeliberately = (raw: string, cwd: string): boolean => {
  if (/[$`]/.test(raw)) return false;
  const expanded = raw === '~' || raw.startsWith('~/') ? join(homedir(), raw.slice(1)) : raw;
  const path = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
  if (!existsSync(path) || !statSync(path).isDirectory()) return false;
  const checkout = findCheckout(path);
  if (!checkout) return false;
  return checkout.isMain ? isAbsolute(expanded) : true;
};

const unresolvedTargets = (command: string, cwd: string): string[] =>
  explicitTargets(command).filter((target) => !namesCheckoutDeliberately(target, cwd));

const currentBranch = (root: string): string | undefined => {
  const head = readFileSync(join(root, '.git/HEAD'), 'utf8').trim();
  return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : undefined;
};

export type SessionState = {
  lastWorktree: (sessionId: string) => string | undefined;
  rememberWorktree: (sessionId: string, worktreeRoot: string) => void;
};

export const fileSessionState = (dir = join(tmpdir(), 'template-worktree-guard')): SessionState => {
  const file = (sessionId: string) => join(dir, sessionId.replace(/[^\w.-]/g, '_'));
  return {
    lastWorktree: (sessionId) =>
      existsSync(file(sessionId)) ? readFileSync(file(sessionId), 'utf8').trim() : undefined,
    rememberWorktree: (sessionId, worktreeRoot) => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file(sessionId), `${worktreeRoot}\n`);
    },
  };
};

export const guard = (input: HookInput, state: SessionState): string | undefined => {
  if (!input.cwd || !input.session_id) return undefined;
  const checkout = findCheckout(input.cwd);
  if (!checkout) return undefined;
  if (!checkout.isMain) {
    state.rememberWorktree(input.session_id, checkout.root);
    return undefined;
  }

  const command = input.tool_input?.command;
  if (input.tool_name !== 'Bash' || !command) return undefined;
  if (!MUTATING.test(command)) return undefined;

  const targets = explicitTargets(command);
  const unresolved = unresolvedTargets(command, input.cwd);
  if (targets.length > 0 && unresolved.length === 0) return undefined;

  const worktree = state.lastWorktree(input.session_id);
  if (!worktree || findCheckout(worktree)?.isMain !== false) return undefined;
  if (currentBranch(checkout.root) !== 'main') return undefined;
  return [
    `This session has been working in the worktree ${worktree}, but the Bash cwd is now the MAIN checkout (${checkout.root}, branch main) — the session cwd resets to main between calls.`,
    ...unresolved.map(
      (target) =>
        `The command names ${target}, which does not exist, is not a git checkout, or is only a relative path into main — so it would run in main anyway.`,
    ),
    'Dependency changes, commits, pushes, merges, worktree registry changes, and new migrations would land on main. Name the directory:',
    `  cd ${worktree} && ${command}`,
    `If main really is the target, say so the same way: cd ${checkout.root} && ${command}`,
  ].join('\n');
};

const main = () => {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const reason = guard(input, fileSessionState(process.env.WORKTREE_GUARD_STATE_DIR));
  if (!reason) return;
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })}\n`,
  );
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    if (process.env.WORKTREE_GUARD_DEBUG) console.error(error);
  }
}
