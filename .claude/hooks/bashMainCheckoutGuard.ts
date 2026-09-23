import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

type HookInput = {
  hook_event_name?: string;
  session_id?: string;
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
};

export const REQUIRE_MAIN_BRANCH = true;

const MASK = '\u0001';
const SEPARATOR_AT = /^(?:\r?\n|;|&&|\|\||\||&|\(|\)|\{|\})/;
const HEREDOC_AT = /^<<(-?)\s*(['"]?)(\w+)\2/;
const LEADING_KEYWORD = /^(?:if|then|else|elif|fi|do|done|while|until|!)(?=\s|$)\s*/;
const LEADING_RUNNER = new RegExp(
  String.raw`^(?:${[
    String.raw`[A-Za-z_]\w*=\S*`,
    String.raw`env(?:\s+-i)?`,
    'command',
    'exec',
    'nohup',
    String.raw`sudo(?:\s+-\S+)*`,
    String.raw`timeout(?:\s+-\S+(?:\s+\S+)?)*\s+\d+\S*`,
    String.raw`nice(?:\s+-n\s+\S+|\s+-\d+)?`,
    'time',
    String.raw`xargs(?:\s+-\S+)*`,
    String.raw`rtk(?:\s+proxy)?`,
    'bunx',
    String.raw`bun\s+x`,
    'npx',
  ].join('|')})(?=\s|$)\s*`,
);
const SHELL_C = /^(?:sh|bash|zsh|dash)(?:\s+-[A-Za-z]+)*\s+-[A-Za-z]*c[A-Za-z]*\s+/;
const EVAL = /^eval\s+/;
const CHANGE_DIR = /^(cd|pushd|popd)(?=\s|$)\s*/;
const GIT_MUTATING = new Set(['commit', 'push', 'merge', 'rebase', 'cherry-pick']);
const GIT_RESUMABLE = new Set(['merge', 'rebase', 'cherry-pick']);
const GIT_WORKTREE_MUTATING = new Set(['add', 'remove', 'move', 'prune']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const GIT_RESUMED = /\s--(?:abort|continue|quit|skip)(?=\s|$)/;
const DRY_RUN = /\s--dry-run(?=\s|$)/;
const BUN_MUTATING = new Set(['add', 'remove', 'update']);
const BUN_SCRIPTS = new Set(['db:migrate']);
const BUN_OPTIONS_WITH_VALUE = new Set([
  '--cwd',
  '--filter',
  '-F',
  '--env-file',
  '--config',
  '-c',
  '--port',
  '--shell',
]);
const PRISMA_MIGRATE_DEV = /^prisma\s+migrate\s+dev(?=\s|$)/;
const QUOTED = /^(["'])([\s\S]*?)\1/;
const ANY_QUOTED = /(["'])([\s\S]*?)\1/g;

const joinContinuations = (command: string) => command.replace(/\\\r?\n/g, ' ');

type Segment = { raw: string; masked: string };

export const segmentCommand = (command: string): Segment[] => {
  const text = joinContinuations(command);
  const segments: Segment[] = [];
  let raw = '';
  let masked = '';
  let pendingHeredocs: { delimiter: string; stripTabs: boolean }[] = [];
  const flush = () => {
    const lead = masked.length - masked.trimStart().length;
    const trail = masked.length - masked.trimEnd().length;
    if (masked.trim()) segments.push({ raw: raw.slice(lead, raw.length - trail), masked: masked.trim() });
    raw = '';
    masked = '';
  };
  const skipHeredocBodies = (from: number): number => {
    let i = from;
    for (const { delimiter, stripTabs } of pendingHeredocs) {
      while (i < text.length) {
        const lineEnd = text.indexOf('\n', i);
        const line = text.slice(i, lineEnd === -1 ? text.length : lineEnd).replace(/\r$/, '');
        i = lineEnd === -1 ? text.length : lineEnd + 1;
        if ((stripTabs ? line.replace(/^\t+/, '') : line) === delimiter) break;
      }
    }
    pendingHeredocs = [];
    return i;
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== ch) end += ch === '"' && text[end] === '\\' ? 2 : 1;
      const inner = text.slice(i + 1, Math.min(end, text.length));
      const close = end < text.length ? ch : '';
      raw += ch + inner + close;
      masked += ch + MASK.repeat(inner.length) + close;
      i = end + 1;
      continue;
    }
    const heredoc = rest.match(HEREDOC_AT);
    if (heredoc && !rest.startsWith('<<<')) {
      pendingHeredocs.push({ delimiter: heredoc[3], stripTabs: heredoc[1] === '-' });
      raw += heredoc[0];
      masked += heredoc[0];
      i += heredoc[0].length;
      continue;
    }
    const separator = rest.match(SEPARATOR_AT);
    if (separator) {
      flush();
      i += separator[0].length;
      if (separator[0].endsWith('\n') && pendingHeredocs.length > 0) i = skipHeredocBodies(i);
      continue;
    }
    raw += ch;
    masked += ch;
    i += 1;
  }
  flush();
  return segments;
};

const take = (segment: Segment, pattern: RegExp): RegExpMatchArray | undefined => {
  const match = segment.masked.match(pattern);
  if (!match) return undefined;
  segment.raw = segment.raw.slice(match[0].length);
  segment.masked = segment.masked.slice(match[0].length);
  return match;
};

const stripPrefixes = (segment: Segment) => {
  while (take(segment, LEADING_KEYWORD) || take(segment, LEADING_RUNNER)) {
    if (!segment.masked) return;
  }
};

const unquote = (token: string) => {
  const quoted = token.match(QUOTED);
  return quoted && quoted[0].length === token.length ? quoted[2] : token;
};

const rawWord = (segment: Segment, maskedWord: string | undefined): string | undefined => {
  if (!maskedWord) return undefined;
  const index = segment.masked.indexOf(maskedWord);
  return index === -1 ? undefined : segment.raw.slice(index, index + maskedWord.length);
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

const resolveDirectory = (rawToken: string, from: string | undefined): string | undefined => {
  const token = unquote(rawToken);
  if (!token || /[$`*?]/.test(token) || token === '-') return undefined;
  const expanded = token === '~' || token.startsWith('~/') ? join(homedir(), token.slice(1)) : token;
  if (!isAbsolute(expanded) && !from) return undefined;
  const path = isAbsolute(expanded) ? expanded : resolve(from as string, expanded);
  return existsSync(path) && statSync(path).isDirectory() ? path : undefined;
};

type Mutation = { command: string; target?: string };

type Invocation = { subcommand?: string; rest: string[]; target?: string };

const parseInvocation = (
  words: string[],
  optionsWithValue: Set<string>,
  targetOption: string,
  from = 1,
): Invocation => {
  let target: string | undefined;
  let i = from;
  while (i < words.length && words[i].startsWith('-')) {
    const [name, inlineValue] = words[i].split(/=(.*)/s);
    if (name === targetOption) target = inlineValue ?? words[i + 1];
    i += inlineValue === undefined && optionsWithValue.has(name) ? 2 : 1;
  }
  return { subcommand: words[i], rest: words.slice(i + 1), target };
};

const mutationIn = (segment: Segment): Mutation | undefined => {
  const { masked } = segment;
  const padded = ` ${masked}`;
  if (DRY_RUN.test(padded)) return undefined;
  const words = masked.split(/\s+/);
  if (words[0] === 'git') {
    const { subcommand, rest, target: maskedTarget } = parseInvocation(words, GIT_OPTIONS_WITH_VALUE, '-C');
    const target = rawWord(segment, maskedTarget);
    if (!subcommand) return undefined;
    if (GIT_MUTATING.has(subcommand)) {
      if (GIT_RESUMABLE.has(subcommand) && GIT_RESUMED.test(padded)) return undefined;
      return { command: masked, target };
    }
    if (subcommand === 'worktree' && GIT_WORKTREE_MUTATING.has(rest[0])) return { command: masked, target };
    return undefined;
  }
  if (words[0] === 'bun') {
    const outer = parseInvocation(words, BUN_OPTIONS_WITH_VALUE, '--cwd');
    if (!outer.subcommand) return undefined;
    if (BUN_MUTATING.has(outer.subcommand)) return { command: masked, target: rawWord(segment, outer.target) };
    if (outer.subcommand !== 'run') return undefined;
    const inner = parseInvocation(['run', ...outer.rest], BUN_OPTIONS_WITH_VALUE, '--cwd');
    const target = rawWord(segment, inner.target ?? outer.target);
    if (!inner.subcommand) return undefined;
    if (BUN_SCRIPTS.has(inner.subcommand)) return { command: masked, target };
    if (inner.subcommand === 'prisma' && PRISMA_MIGRATE_DEV.test(['prisma', ...inner.rest].join(' ')))
      return { command: masked, target };
    return undefined;
  }
  if (PRISMA_MIGRATE_DEV.test(masked)) return { command: masked };
  return undefined;
};

export type Landing = { command: string; directory: string | undefined; namedTarget?: string };

const collectMutations = (command: string, cwd: string | undefined, landings: Landing[]) => {
  let cursor: string | undefined = cwd;
  for (const segment of segmentCommand(command)) {
    stripPrefixes(segment);
    if (!segment.masked) continue;
    const changeDir = take(segment, CHANGE_DIR);
    if (changeDir) {
      if (changeDir[1] === 'popd') {
        cursor = undefined;
        continue;
      }
      const token = segment.masked.match(/^\S+/)?.[0];
      cursor = resolveDirectory(token ? (rawWord(segment, token) ?? token) : '~', cursor);
      continue;
    }
    if (take(segment, SHELL_C)) {
      collectMutations(segment.raw.match(QUOTED)?.[2] ?? segment.raw, cursor, landings);
      continue;
    }
    if (take(segment, EVAL)) {
      const quoted = [...segment.raw.matchAll(ANY_QUOTED)].map((match) => match[2]);
      collectMutations(quoted.length > 0 ? quoted.join(' ') : segment.raw, cursor, landings);
      continue;
    }
    const mutation = mutationIn(segment);
    if (!mutation) continue;
    const directory = mutation.target ? resolveDirectory(mutation.target, cursor) : cursor;
    landings.push({ command: mutation.command, directory, namedTarget: mutation.target });
  }
};

export const mutationsIn = (command: string, cwd?: string): Landing[] => {
  const landings: Landing[] = [];
  collectMutations(command, cwd, landings);
  return landings;
};

export const isMutating = (command: string) => mutationsIn(command).length > 0;

const currentBranch = (root: string): string | undefined => {
  const head = readFileSync(join(root, '.git/HEAD'), 'utf8').trim();
  return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : undefined;
};

export const defaultBranch = (root: string): string => {
  const originHead = join(root, '.git/refs/remotes/origin/HEAD');
  if (!existsSync(originHead)) return 'main';
  const ref = readFileSync(originHead, 'utf8').trim();
  const prefix = 'ref: refs/remotes/origin/';
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : 'main';
};

export type SessionState = {
  lastWorktree: (sessionId: string) => string | undefined;
  rememberWorktree: (sessionId: string, worktreeRoot: string) => void;
  prune: (maxAgeMs: number) => void;
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
    prune: (maxAgeMs) => {
      if (!existsSync(dir)) return;
      const cutoff = Date.now() - maxAgeMs;
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
      }
    },
  };
};

export type GuardOptions = { requireMainBranch?: boolean };

const landsOnMain = ({ directory }: Landing) => {
  if (!directory) return true;
  const target = findCheckout(directory);
  return !target || target.isMain;
};

const describe = ({ command, directory, namedTarget }: Landing) => {
  if (directory) return `  \`${command}\` would run in ${directory}, which is the main checkout.`;
  if (namedTarget) return `  \`${command}\` names ${namedTarget}, which does not exist or cannot be resolved.`;
  return `  \`${command}\` runs in a directory this hook cannot resolve.`;
};

export const guard = (input: HookInput, state: SessionState, options: GuardOptions = {}): string | undefined => {
  const requireMainBranch = options.requireMainBranch ?? REQUIRE_MAIN_BRANCH;
  if (!input.cwd || !input.session_id) return undefined;
  const checkout = findCheckout(input.cwd);
  if (!checkout) return undefined;
  if (!checkout.isMain) {
    state.rememberWorktree(input.session_id, checkout.root);
    return undefined;
  }

  const command = input.tool_input?.command;
  if (input.tool_name !== 'Bash' || !command) return undefined;

  const worktree = state.lastWorktree(input.session_id);
  if (!worktree || findCheckout(worktree)?.isMain !== false) return undefined;
  const branch = currentBranch(checkout.root);
  if (requireMainBranch && branch !== defaultBranch(checkout.root)) return undefined;

  const landings = mutationsIn(command, input.cwd).filter(landsOnMain);
  if (landings.length === 0) return undefined;

  return [
    `This session has been working in the worktree ${worktree}, but the Bash cwd is now the MAIN checkout (${checkout.root}, branch ${branch}) — the session cwd resets to main between calls.`,
    ...landings.map(describe),
    'Dependency changes, commits, pushes, merges, worktree registry changes, and new migrations would land on main. Run it from the worktree:',
    `  cd ${worktree} && ${command}`,
    `If the main checkout really is the target, check out a working branch there first (it is on ${branch}) or run the command outside this session.`,
  ].join('\n');
};

const main = () => {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const state = fileSessionState(process.env.WORKTREE_GUARD_STATE_DIR);
  if (input.hook_event_name === 'SessionStart') state.prune(24 * 60 * 60 * 1000);
  const reason = guard(input, state);
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
