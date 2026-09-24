import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

type HookInput = {
  hook_event_name?: string;
  session_id?: string;
  agent_id?: string;
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
};

const GIT_MUTATING = new Set(['commit', 'push', 'merge', 'rebase', 'cherry-pick', 'revert', 'am']);
const GIT_WORKTREE_LIFECYCLE = new Set(['add', 'remove', 'move', 'prune']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree']);
const BUN_MUTATING = new Set(['add', 'a', 'remove', 'rm', 'update']);
const BUN_INSTALL = new Set(['install', 'i']);
const BUN_OPTIONS_WITH_VALUE = new Set([
  '--filter',
  '-F',
  '--linker',
  '--backend',
  '--omit',
  '--registry',
  '--config',
  '-c',
  '--env-file',
]);
const PASS_THROUGH = new Set(['rtk', 'proxy', 'env', 'command', 'sudo', 'time', 'nohup', 'bunx', 'npx']);

export type Landing = {
  command: string;
  directory?: string;
  absolute: boolean;
  lifecycle: boolean;
};

const unquote = (token: string) => token.replace(/^(['"])(.*)\1$/s, '$2');

const withoutHeredocBodies = (command: string) =>
  command.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\n|$)/g, '$3');

const maskQuoted = (command: string) =>
  command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, (quoted) =>
    quoted.replace(/[\s;&|(){}]/g, (ch) => `\u0001${ch.charCodeAt(0)}\u0002`),
  );

const unmask = (text: string) => text.replace(/\u0001(\d+)\u0002/g, (_, code) => String.fromCharCode(Number(code)));

const expandHome = (path: string) => (path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path);

const realOrResolved = (path: string) => (existsSync(path) ? realpathSync(path) : resolve(path));

type Cursor = { directory?: string; absolute: boolean };

const moveTo = (cursor: Cursor, target: string | undefined): Cursor => {
  const path = expandHome(unquote(target ?? '~'));
  if (/[$`]/.test(path)) return { absolute: false };
  if (isAbsolute(path)) return { directory: realOrResolved(path), absolute: true };
  if (!cursor.directory) return cursor;
  return { directory: realOrResolved(resolve(cursor.directory, path)), absolute: cursor.absolute };
};

const commandWords = (segment: string): string[] => {
  const words = segment
    .replace(/[(){}]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let start = 0;
  while (start < words.length && (/^[A-Za-z_]\w*=/.test(words[start]) || PASS_THROUGH.has(basename(words[start]))))
    start += 1;
  return words.slice(start).map((word, i) => (i === 0 ? basename(unquote(unmask(word))) : unmask(word)));
};

const gitLanding = (words: string[], cursor: Cursor): Omit<Landing, 'command'> | undefined => {
  let here = cursor;
  let i = 1;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C') here = moveTo(here, words[i + 1]);
    i += GIT_OPTIONS_WITH_VALUE.has(words[i]) ? 2 : 1;
  }
  const subcommand = words[i];
  if (subcommand === 'worktree' && GIT_WORKTREE_LIFECYCLE.has(words[i + 1] ?? '')) return { ...here, lifecycle: true };
  return GIT_MUTATING.has(subcommand ?? '') ? { ...here, lifecycle: false } : undefined;
};

const isPrismaMigrateDev = (words: string[]) => words.join(' ').match(/(^|\s)prisma migrate dev(\s|$)/) !== null;

const bunLanding = (words: string[], cursor: Cursor): Omit<Landing, 'command'> | undefined => {
  let here = cursor;
  const positionals: string[] = [];
  for (let i = 1; i < words.length; i += 1) {
    const [name, inline] = words[i].split(/=(.*)/s);
    if (name === '--cwd') here = moveTo(here, inline ?? words[i + 1]);
    if ((name === '--cwd' || BUN_OPTIONS_WITH_VALUE.has(name)) && inline === undefined) i += 1;
    else if (!words[i].startsWith('-')) positionals.push(words[i]);
  }
  const [subcommand, ...rest] = positionals;
  const script = subcommand === 'run' ? rest[0] : subcommand;
  const mutating =
    BUN_MUTATING.has(subcommand ?? '') ||
    (BUN_INSTALL.has(subcommand ?? '') && rest.length > 0) ||
    script === 'db:migrate' ||
    isPrismaMigrateDev(positionals);
  return mutating ? { ...here, lifecycle: false } : undefined;
};

const landingOf = (words: string[], cursor: Cursor): Omit<Landing, 'command'> | undefined => {
  if (words[0] === 'git') return gitLanding(words, cursor);
  if (words[0] === 'bun') return bunLanding(words, cursor);
  return words[0] === 'prisma' && isPrismaMigrateDev(words) ? { ...cursor, lifecycle: false } : undefined;
};

export const landingsIn = (command: string, cwd: string): Landing[] => {
  const landings: Landing[] = [];
  let cursor: Cursor = { directory: realOrResolved(cwd), absolute: false };
  const subshells: Cursor[] = [];
  for (const segment of maskQuoted(withoutHeredocBodies(command)).split(/&&|\|\||[;|\n]/)) {
    const opens = segment.match(/^\s*\(+/)?.[0].trim().length ?? 0;
    const closes = segment.match(/\)+\s*$/)?.[0].trim().length ?? 0;
    for (let i = 0; i < opens; i += 1) subshells.push(cursor);
    const words = commandWords(segment);
    if (words[0] === 'cd' || words[0] === 'pushd') {
      cursor = moveTo(
        cursor,
        words.find((word, i) => i > 0 && !word.startsWith('-')),
      );
    } else {
      const landing = words.length > 0 ? landingOf(words, cursor) : undefined;
      if (landing) landings.push({ command: unmask(segment).trim(), ...landing });
    }
    for (let i = 0; i < closes && subshells.length > 0; i += 1) cursor = subshells.pop() as Cursor;
  }
  return landings;
};

type Checkout = { root: string; mainRoot: string };

const mainRootOfLinked = (dotGitFile: string): string | undefined => {
  const gitdir = readFileSync(dotGitFile, 'utf8')
    .match(/^gitdir:\s*(.+)$/m)?.[1]
    ?.trim();
  if (!gitdir) return undefined;
  const commonDir = resolve(dirname(dotGitFile), gitdir, '..', '..');
  return basename(commonDir) === '.git' && existsSync(commonDir) ? realpathSync(dirname(commonDir)) : undefined;
};

const findCheckout = (from: string): Checkout | undefined => {
  let dir = resolve(from);
  while (true) {
    const dotGit = join(dir, '.git');
    if (existsSync(dotGit)) {
      const root = realpathSync(dir);
      if (statSync(dotGit).isDirectory()) return { root, mainRoot: root };
      const mainRoot = mainRootOfLinked(dotGit);
      return mainRoot ? { root, mainRoot } : undefined;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
};

const isWithin = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

export const registeredWorktrees = (mainRoot: string): string[] => {
  try {
    const listing = execFileSync('git', ['-C', mainRoot, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return listing
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length).trim())
      .filter((path) => existsSync(path))
      .map((path) => realpathSync(path))
      .filter((path) => path !== realpathSync(mainRoot));
  } catch {
    return [];
  }
};

export type SessionState = {
  lastWorktree: (sessionId: string) => string | undefined;
  rememberWorktree: (sessionId: string, worktreeRoot: string) => void;
  prune: (maxAgeMs: number) => void;
};

export const fileSessionState = (dir = join(tmpdir(), 'template-worktree-guard')): SessionState => {
  const file = (sessionId: string) => join(dir, createHash('sha256').update(sessionId).digest('hex').slice(0, 32));
  return {
    lastWorktree: (sessionId) =>
      existsSync(file(sessionId)) ? readFileSync(file(sessionId), 'utf8').trim() : undefined,
    rememberWorktree: (sessionId, worktreeRoot) => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file(sessionId), `${worktreeRoot}\n`);
    },
    prune: (maxAgeMs) => {
      if (!existsSync(dir)) return;
      const cutoff = Date.now() - maxAgeMs;
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if ((statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) < cutoff) rmSync(path, { force: true });
      }
    },
  };
};

const lifecycleDenial = (landings: Landing[]) =>
  [
    'Worktrees are created and destroyed only through the repo scripts, which provision and tear down the slot (ports, env files, databases, buckets, install, generated artifacts):',
    ...landings.map((landing) => `  \`${landing.command}\``),
    'Use `bun run worktree:create <base> <new-branch>` / `bun run worktree:create <existing-branch>`, `bun run worktree:destroy <name>`, `bun run worktree:list`.',
  ].join('\n');

const driftDenial = (landings: Landing[], worktree: string, mainRoot: string) =>
  [
    `This session is working in the worktree ${worktree}, but these would run in the main checkout (${mainRoot}):`,
    ...landings.map((landing) => `  \`${landing.command}\``),
    'Run them in the worktree:',
    ...landings.map((landing) => `  cd ${worktree} && ${landing.command}`),
    `If the main checkout really is the target, name it by its absolute path: cd ${mainRoot} && …`,
  ].join('\n');

const armedWorktree = (stateKey: string, state: SessionState, registered: string[]): string | undefined => {
  const worktree = state.lastWorktree(stateKey);
  if (!worktree || !existsSync(worktree)) return undefined;
  const real = realpathSync(worktree);
  return registered.some((root) => isWithin(real, root)) ? worktree : undefined;
};

export const guard = (input: HookInput, state: SessionState): string | undefined => {
  if (!input.cwd || !input.session_id) return undefined;
  const checkout = findCheckout(input.cwd);
  if (!checkout) return undefined;
  const { root, mainRoot } = checkout;
  const stateKey = [input.session_id, input.agent_id ?? '', mainRoot].join('\0');
  if (root !== mainRoot) state.rememberWorktree(stateKey, root);

  const command = input.tool_input?.command;
  if (input.tool_name !== 'Bash' || !command) return undefined;
  const landings = landingsIn(command, input.cwd);

  const lifecycle = landings.filter((landing) => landing.lifecycle);
  if (lifecycle.length > 0) return lifecycleDenial(lifecycle);

  if (landings.length === 0) return undefined;
  const registered = registeredWorktrees(mainRoot);
  const worktree = armedWorktree(stateKey, state, registered);
  if (!worktree) return undefined;
  const drifted = landings.filter(
    (landing) =>
      !landing.absolute &&
      landing.directory !== undefined &&
      isWithin(landing.directory, mainRoot) &&
      !registered.some((root) => isWithin(landing.directory as string, root)),
  );
  return drifted.length > 0 ? driftDenial(drifted, worktree, mainRoot) : undefined;
};

const main = () => {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const state = fileSessionState(process.env.WORKTREE_GUARD_STATE_DIR);
  if (input.hook_event_name === 'SessionStart') state.prune(24 * 60 * 60 * 1000);
  const reason = guard(input, state);
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
    console.error(`bashMainCheckoutGuard: failed open: ${(error as Error).message}`);
  }
}
