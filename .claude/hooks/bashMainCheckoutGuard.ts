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
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
};

export const REQUIRE_MAIN_BRANCH = true;
const MAX_DEPTH = 6;

const MASK = '\u0001';
const HEREDOC_AT = /^<<(-?)\s*(['"]?)(\w+)\2/;
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', '!']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
const RUNNERS: Record<string, { values: Set<string>; positionals?: number; stopOn?: Set<string> }> = {
  env: { values: new Set(['-u', '--unset', '-S', '--split-string']) },
  command: { values: new Set(), stopOn: new Set(['-v', '-V']) },
  exec: { values: new Set(['-a']) },
  nohup: { values: new Set() },
  sudo: { values: new Set(['-u', '-g', '-C', '-h', '-p', '-U', '-r', '-t', '-D', '--user', '--group']) },
  doas: { values: new Set(['-u']) },
  timeout: { values: new Set(['-k', '-s', '--kill-after', '--signal']), positionals: 1 },
  nice: { values: new Set(['-n', '--adjustment']) },
  time: { values: new Set(['-o', '-f']) },
  xargs: { values: new Set(['-n', '-I', '-P', '-L', '-s', '-d', '-E', '-a', '-i']) },
  rtk: { values: new Set() },
  bunx: { values: new Set(['-p', '--package']) },
  npx: { values: new Set(['-p', '--package', '-c', '--call']) },
  pnpx: { values: new Set() },
};
const GIT_MUTATING = new Set(['commit', 'push', 'merge', 'rebase', 'cherry-pick', 'revert', 'am']);
const GIT_RESUMABLE = new Set(['merge', 'rebase', 'cherry-pick', 'revert', 'am']);
const GIT_WORKTREE_MUTATING = new Set(['add', 'remove', 'move', 'prune']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const GIT_RESUMED = new Set(['--abort', '--continue', '--quit', '--skip']);
const BUN_MUTATING = new Set(['add', 'a', 'remove', 'rm', 'update']);
const BUN_INSTALL = new Set(['install', 'i']);
const BUN_SCRIPTS = new Set(['db:migrate']);
const BUN_OPTIONS_WITH_VALUE = new Set([
  '--cwd',
  '--filter',
  '-F',
  '--backend',
  '--registry',
  '--config',
  '-c',
  '--target',
  '--env-file',
  '--port',
  '--shell',
  '--linker',
  '--omit',
  '--concurrent-scripts',
  '--network-concurrency',
]);
const CD_OPTIONS = new Set(['-P', '-L', '-e', '-@', '--']);
const SHELL_OPTIONS_WITH_VALUE = new Set(['-o', '+o', '-O', '+O', '--rcfile', '--init-file']);

type Piece =
  | { kind: 'open' | 'close' }
  | { kind: 'command'; raw: string; masked: string; terminator: string; substitutions: string[] };

const isWordBoundary = (ch: string | undefined) => ch === undefined || /[\s;&|(){}]/.test(ch);

export const segmentCommand = (command: string): Piece[] => {
  const text = command.replace(/\\\r?\n/g, '');
  const pieces: Piece[] = [];
  let raw = '';
  let masked = '';
  let substitutions: string[] = [];
  let pendingHeredocs: { delimiter: string; stripTabs: boolean }[] = [];

  const flush = (terminator: string) => {
    const lead = masked.length - masked.trimStart().length;
    const trail = masked.length - masked.trimEnd().length;
    if (masked.trim()) {
      pieces.push({
        kind: 'command',
        raw: raw.slice(lead, raw.length - trail),
        masked: masked.trim(),
        terminator,
        substitutions,
      });
    }
    raw = '';
    masked = '';
    substitutions = [];
  };
  const add = (r: string, m = r) => {
    raw += r;
    masked += m;
  };
  const scanSingle = (from: number) => {
    const end = text.indexOf("'", from + 1);
    return end === -1 ? text.length : end;
  };
  const scanBacktick = (from: number) => {
    let j = from + 1;
    while (j < text.length && text[j] !== '`') j += text[j] === '\\' ? 2 : 1;
    return Math.min(j, text.length);
  };
  const scanParen = (from: number): number => {
    let depth = 1;
    let j = from + 1;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '\\') j += 2;
      else if (ch === "'") j = scanSingle(j) + 1;
      else if (ch === '"') j = scanDouble(j) + 1;
      else if (ch === '`') j = scanBacktick(j) + 1;
      else if (ch === '(') {
        depth += 1;
        j += 1;
      } else if (ch === ')') {
        depth -= 1;
        if (depth === 0) return j;
        j += 1;
      } else j += 1;
    }
    return text.length;
  };
  const scanDouble = (from: number): number => {
    let j = from + 1;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '\\') j += 2;
      else if (ch === '"') return j;
      else if (ch === '$' && text[j + 1] === '(') j = scanParen(j + 1) + 1;
      else if (ch === '`') j = scanBacktick(j) + 1;
      else j += 1;
    }
    return text.length;
  };
  const collectSubstitutions = (from: number, to: number) => {
    let j = from;
    while (j < to) {
      const ch = text[j];
      if (ch === '\\') j += 2;
      else if (ch === '$' && text[j + 1] === '(') {
        const end = scanParen(j + 1);
        substitutions.push(text.slice(j + 2, end));
        j = end + 1;
      } else if (ch === '`') {
        const end = scanBacktick(j);
        substitutions.push(text.slice(j + 1, end));
        j = end + 1;
      } else j += 1;
    }
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
  const masking = (from: number, to: number) => text.slice(from, to).replace(/[^\n]/g, MASK);

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const prev = i === 0 ? undefined : text[i - 1];
    const next = text[i + 1];
    if (ch === '\\') {
      add(text.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (ch === "'") {
      const end = scanSingle(i);
      const inner = text.slice(i + 1, end);
      const close = end < text.length ? "'" : '';
      add(`'${inner}${close}`, `'${MASK.repeat(inner.length)}${close}`);
      i = end + 1;
      continue;
    }
    if (ch === '"') {
      const end = scanDouble(i);
      collectSubstitutions(i + 1, end);
      const inner = text.slice(i + 1, end);
      const close = end < text.length ? '"' : '';
      add(`"${inner}${close}`, `"${MASK.repeat(inner.length)}${close}`);
      i = end + 1;
      continue;
    }
    if (ch === '`') {
      const end = scanBacktick(i);
      substitutions.push(text.slice(i + 1, end));
      const stop = Math.min(end + 1, text.length);
      add(text.slice(i, stop), masking(i, stop));
      i = stop;
      continue;
    }
    if (ch === '$' && next === '(') {
      const end = scanParen(i + 1);
      substitutions.push(text.slice(i + 2, end));
      const stop = Math.min(end + 1, text.length);
      add(text.slice(i, stop), masking(i, stop));
      i = stop;
      continue;
    }
    if (ch === '$' && next === '{') {
      let depth = 0;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '{') depth += 1;
        else if (text[j] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        j += 1;
      }
      const stop = Math.min(j + 1, text.length);
      add(text.slice(i, stop), `$${MASK.repeat(stop - i - 1)}`);
      i = stop;
      continue;
    }
    if (ch === '#' && isWordBoundary(prev)) {
      const lineEnd = text.indexOf('\n', i);
      i = lineEnd === -1 ? text.length : lineEnd;
      continue;
    }
    if (text.startsWith('<<<', i)) {
      add('<<<');
      i += 3;
      continue;
    }
    const heredoc = text.slice(i).match(HEREDOC_AT);
    if (heredoc) {
      pendingHeredocs.push({ delimiter: heredoc[3], stripTabs: heredoc[1] === '-' });
      add(heredoc[0]);
      i += heredoc[0].length;
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      flush('\n');
      i += ch === '\r' ? 2 : 1;
      if (pendingHeredocs.length > 0) i = skipHeredocBodies(i);
      continue;
    }
    if (ch === ';') {
      flush(';');
      i += next === ';' ? 2 : 1;
      continue;
    }
    if (ch === '&' && next === '&') {
      flush('&&');
      i += 2;
      continue;
    }
    if (ch === '|' && next === '|') {
      flush('||');
      i += 2;
      continue;
    }
    if (ch === '|') {
      flush('|');
      i += next === '&' ? 2 : 1;
      continue;
    }
    if (ch === '&' && prev !== '>' && prev !== '<' && next !== '>') {
      flush('&');
      i += 1;
      continue;
    }
    if (ch === '(') {
      flush('(');
      pieces.push({ kind: 'open' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      flush(')');
      pieces.push({ kind: 'close' });
      i += 1;
      continue;
    }
    if ((ch === '{' || ch === '}') && isWordBoundary(prev) && (next === undefined || /[\s;&|)]/.test(next))) {
      flush(ch);
      i += 1;
      continue;
    }
    add(ch);
    i += 1;
  }
  flush('');
  return pieces;
};

type Word = { raw: string; masked: string };

const tokenize = (raw: string, masked: string): Word[] => {
  const words: Word[] = [];
  const pattern = /\S+/g;
  for (const match of masked.matchAll(pattern)) {
    const start = match.index ?? 0;
    words.push({ raw: raw.slice(start, start + match[0].length), masked: match[0] });
  }
  return words;
};

const unquote = (token: string) => {
  const trimmed = token.startsWith('$') && /^\$'/.test(token) ? token.slice(1) : token;
  const match = trimmed.match(/^(["'])([\s\S]*)\1$/);
  return match ? match[2] : trimmed;
};

const headOf = (word: Word): string | undefined => {
  if (/\$\(|`|\$\{/.test(word.raw)) return undefined;
  let head = word.raw.replace(/^\\/, '').replace(/\$'/g, "'").replace(/["']/g, '');
  if (head.includes('/')) head = basename(head);
  return head;
};

const isAssignment = (word: Word) => /^[A-Za-z_]\w*=/.test(word.raw);

type Prefix = { words: Word[]; bare: string; gitDir?: string; gitWorkTree?: string };

const stripPrefixes = (words: Word[], raw: string): Prefix => {
  let rest = words;
  let bareStart = 0;
  let gitDir: string | undefined;
  let gitWorkTree: string | undefined;
  const consumeKeywords = () => {
    while (rest.length > 0 && KEYWORDS.has(rest[0].raw)) {
      bareStart += 1;
      rest = rest.slice(1);
    }
  };
  consumeKeywords();
  const bare = tokenize(raw, raw)
    .slice(bareStart)
    .map((w) => w.raw)
    .join(' ');
  for (let guard = 0; guard < 32 && rest.length > 0; guard += 1) {
    const word = rest[0];
    if (isAssignment(word)) {
      const [name, value] = word.raw.split(/=(.*)/s);
      if (name === 'GIT_DIR') gitDir = value;
      if (name === 'GIT_WORK_TREE') gitWorkTree = value;
      rest = rest.slice(1);
      continue;
    }
    const head = headOf(word);
    if (!head) break;
    if (head === 'bun' && rest[1]?.raw === 'x') {
      rest = rest.slice(2);
      continue;
    }
    if (head === 'rtk') {
      rest = rest.slice(rest[1]?.raw === 'proxy' ? 2 : 1);
      continue;
    }
    const runner = RUNNERS[head];
    if (!runner) break;
    let j = 1;
    let positionals = runner.positionals ?? 0;
    let stopped = false;
    while (j < rest.length) {
      const current = rest[j].raw;
      if (current === '--') {
        j += 1;
        break;
      }
      if (runner.stopOn?.has(current)) {
        stopped = true;
        break;
      }
      if (current.startsWith('-') && current.length > 1) {
        const [name, inline] = current.split(/=(.*)/s);
        j += inline === undefined && runner.values.has(name) ? 2 : 1;
        continue;
      }
      if (positionals > 0) {
        positionals -= 1;
        j += 1;
        continue;
      }
      break;
    }
    if (stopped) return { words: [], bare, gitDir, gitWorkTree };
    rest = rest.slice(j);
  }
  return { words: rest, bare, gitDir, gitWorkTree };
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

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

const isWithin = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

type Target = { directory: string; named?: string };

const expandToken = (rawToken: string): string | undefined => {
  const token = unquote(rawToken);
  if (!token || /[$`*?]/.test(token) || token === '-') return undefined;
  return token === '~' || token.startsWith('~/') ? join(homedir(), token.slice(1)) : token;
};

const resolveTarget = (rawToken: string, from: Target | undefined): Target | undefined => {
  const expanded = expandToken(rawToken);
  if (!expanded) return undefined;
  if (isAbsolute(expanded)) {
    const named = resolve(expanded);
    return isDirectory(named) ? { directory: realpathSync(named), named } : undefined;
  }
  if (!from) return undefined;
  const path = resolve(from.directory, expanded);
  return isDirectory(path) ? { directory: realpathSync(path) } : undefined;
};

const resolveRedirect = (rawToken: string, from: Target | undefined, gitDir: boolean): string | undefined => {
  const expanded = expandToken(rawToken);
  if (!expanded) return undefined;
  if (!isAbsolute(expanded) && !from) return undefined;
  const path = isAbsolute(expanded) ? resolve(expanded) : resolve(from?.directory as string, expanded);
  if (!existsSync(path)) return undefined;
  const real = realpathSync(path);
  if (!gitDir) return statSync(real).isDirectory() ? real : dirname(real);
  return statSync(real).isDirectory() && basename(real) !== '.git' ? real : dirname(real);
};

type Mutation = { target?: string; redirect?: { via: string; path: string } };

type Parsed = { positionals: Word[]; target?: string; options: Set<string>; gitDir?: string; gitWorkTree?: string };

const parseGit = (words: Word[]): Parsed => {
  const options = new Set<string>();
  let target: string | undefined;
  let gitDir: string | undefined;
  let gitWorkTree: string | undefined;
  let i = 1;
  while (i < words.length && words[i].masked.startsWith('-')) {
    const [name, inline] = words[i].masked.split(/=(.*)/s);
    const value =
      inline === undefined && GIT_OPTIONS_WITH_VALUE.has(name) ? words[i + 1]?.raw : words[i].raw.split(/=(.*)/s)[1];
    if (name === '-C') target = value;
    if (name === '--git-dir') gitDir = value;
    if (name === '--work-tree') gitWorkTree = value;
    i += inline === undefined && GIT_OPTIONS_WITH_VALUE.has(name) ? 2 : 1;
  }
  const positionals = words.slice(i);
  for (const word of positionals) if (word.masked.startsWith('-')) options.add(word.masked);
  return { positionals: positionals.filter((w) => !w.masked.startsWith('-')), target, options, gitDir, gitWorkTree };
};

const parseBun = (words: Word[]): Parsed => {
  const options = new Set<string>();
  const positionals: Word[] = [];
  let target: string | undefined;
  let i = 1;
  while (i < words.length) {
    const word = words[i];
    if (word.masked.startsWith('-') && word.masked.length > 1) {
      const [name, inline] = word.masked.split(/=(.*)/s);
      const takesValue = inline === undefined && BUN_OPTIONS_WITH_VALUE.has(name);
      options.add(name);
      if (name === '--cwd') target = takesValue ? words[i + 1]?.raw : word.raw.split(/=(.*)/s)[1];
      i += takesValue ? 2 : 1;
      continue;
    }
    positionals.push(word);
    i += 1;
  }
  return { positionals, target, options };
};

const isPrismaMigrateDev = (words: Word[]) =>
  words[0]?.masked === 'prisma' && words[1]?.masked === 'migrate' && words[2]?.masked === 'dev';

const mutationIn = (head: string, words: Word[], prefix: Prefix): Mutation | undefined => {
  if (head === 'git') {
    const parsed = parseGit(words);
    if (parsed.options.has('--dry-run')) return undefined;
    const subcommand = parsed.positionals[0]?.masked;
    if (!subcommand) return undefined;
    const gitDir = parsed.gitDir ?? prefix.gitDir;
    const gitWorkTree = parsed.gitWorkTree ?? prefix.gitWorkTree;
    const redirect = gitWorkTree
      ? { via: parsed.gitWorkTree ? '--work-tree' : 'GIT_WORK_TREE', path: gitWorkTree }
      : gitDir
        ? { via: parsed.gitDir ? '--git-dir' : 'GIT_DIR', path: gitDir }
        : undefined;
    if (GIT_MUTATING.has(subcommand)) {
      if (GIT_RESUMABLE.has(subcommand) && [...parsed.options].some((o) => GIT_RESUMED.has(o))) return undefined;
      return { target: parsed.target, redirect };
    }
    if (subcommand === 'worktree' && GIT_WORKTREE_MUTATING.has(parsed.positionals[1]?.masked ?? ''))
      return { target: parsed.target, redirect };
    return undefined;
  }
  if (head === 'bun') {
    const parsed = parseBun(words);
    if (parsed.options.has('--dry-run')) return undefined;
    const subcommand = parsed.positionals[0]?.masked;
    if (!subcommand) return undefined;
    const rest = parsed.positionals.slice(1);
    if (BUN_MUTATING.has(subcommand)) return { target: parsed.target };
    if (BUN_INSTALL.has(subcommand)) return rest.length > 0 ? { target: parsed.target } : undefined;
    if (BUN_SCRIPTS.has(subcommand) || isPrismaMigrateDev(parsed.positionals)) return { target: parsed.target };
    if (subcommand !== 'run') return undefined;
    const script = rest[0]?.masked;
    if (script && (BUN_SCRIPTS.has(script) || isPrismaMigrateDev(rest))) return { target: parsed.target };
    return undefined;
  }
  if (head === 'prisma')
    return isPrismaMigrateDev(words) && !words.some((w) => w.masked === '--dry-run') ? {} : undefined;
  return undefined;
};

export type Landing = {
  command: string;
  directory?: string;
  named?: string;
  namedTarget?: string;
  redirect?: string;
  reason?: string;
};

const shellCommandString = (words: Word[]): string | undefined => {
  let dashC = false;
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    if (word.masked === '--') return dashC ? unquote(words[i + 1]?.raw ?? '') : undefined;
    if (word.masked.startsWith('-') || word.masked.startsWith('+')) {
      if (/^-[A-Za-z]*c[A-Za-z]*$/.test(word.masked)) dashC = true;
      if (SHELL_OPTIONS_WITH_VALUE.has(word.masked) || /^[-+][A-Za-z]*[oO]$/.test(word.masked)) i += 1;
      continue;
    }
    return dashC ? unquote(word.raw) : undefined;
  }
  return undefined;
};

const collectMutations = (command: string, cwd: Target | undefined, landings: Landing[], depth: number) => {
  if (depth > MAX_DEPTH) {
    landings.push({ command, reason: 'nested more deeply than this hook analyses' });
    return;
  }
  let cursor: Target | undefined = cwd;
  const stack: (Target | undefined)[] = [];
  for (const piece of segmentCommand(command)) {
    if (piece.kind !== 'command') {
      if (piece.kind === 'open') stack.push(cursor);
      else if (stack.length > 0) cursor = stack.pop();
      continue;
    }
    for (const substitution of piece.substitutions) collectMutations(substitution, cursor, landings, depth + 1);
    const prefix = stripPrefixes(tokenize(piece.raw, piece.masked), piece.raw);
    const words = prefix.words;
    if (words.length === 0) continue;
    const head = headOf(words[0]);
    if (!head) continue;
    if (head === 'cd' || head === 'pushd' || head === 'popd') {
      const backgrounded = piece.terminator === '|' || piece.terminator === '&';
      if (backgrounded) continue;
      if (head === 'popd') {
        cursor = undefined;
        continue;
      }
      const target = words.slice(1).find((w) => !CD_OPTIONS.has(w.masked) && !/^-[PLe@]+$/.test(w.masked));
      cursor = resolveTarget(target?.raw ?? '~', cursor);
      continue;
    }
    if (SHELLS.has(head)) {
      const inner = shellCommandString(words);
      if (inner) collectMutations(inner, cursor, landings, depth + 1);
      continue;
    }
    if (head === 'eval') {
      const inner = words
        .slice(1)
        .map((w) => unquote(w.raw))
        .join(' ');
      collectMutations(inner, cursor, landings, depth + 1);
      continue;
    }
    const mutation = mutationIn(head, words, prefix);
    if (!mutation) continue;
    if (mutation.redirect) {
      const directory = resolveRedirect(
        mutation.redirect.path,
        cursor,
        mutation.redirect.via.endsWith('DIR') || mutation.redirect.via === '--git-dir',
      );
      landings.push({
        command: prefix.bare,
        directory,
        redirect: mutation.redirect.via,
        namedTarget: mutation.redirect.path,
      });
      continue;
    }
    const target = mutation.target ? resolveTarget(mutation.target, cursor) : cursor;
    landings.push({
      command: prefix.bare,
      directory: target?.directory,
      named: target?.named,
      namedTarget: mutation.target,
    });
  }
};

export const mutationsIn = (command: string, cwd?: string): Landing[] => {
  const landings: Landing[] = [];
  collectMutations(command, cwd && isDirectory(cwd) ? { directory: realpathSync(cwd) } : undefined, landings, 0);
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

export const registeredWorktrees = (mainRoot: string): string[] => {
  try {
    const listing = execFileSync('git', ['-C', mainRoot, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const mainReal = realpathSync(mainRoot);
    return listing
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length).trim())
      .filter((path) => isDirectory(path))
      .map((path) => realpathSync(path))
      .filter((path) => path !== mainReal);
  } catch {
    return [];
  }
};

export type SessionState = {
  lastWorktree: (sessionId: string) => string | undefined;
  rememberWorktree: (sessionId: string, worktreeRoot: string) => void;
  prune: (maxAgeMs: number) => void;
};

const reportOnce = (() => {
  let reported = false;
  return (message: string) => {
    if (reported) return;
    reported = true;
    console.error(`bashMainCheckoutGuard: ${message}`);
  };
})();

export const fileSessionState = (dir = join(tmpdir(), 'template-worktree-guard')): SessionState => {
  const file = (sessionId: string) => join(dir, createHash('sha256').update(sessionId).digest('hex').slice(0, 32));
  return {
    lastWorktree: (sessionId) => {
      try {
        return existsSync(file(sessionId)) ? readFileSync(file(sessionId), 'utf8').trim() : undefined;
      } catch (error) {
        reportOnce(`could not read session state: ${(error as Error).message}`);
        return undefined;
      }
    },
    rememberWorktree: (sessionId, worktreeRoot) => {
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file(sessionId), `${worktreeRoot}\n`);
      } catch (error) {
        reportOnce(`could not write session state: ${(error as Error).message}`);
      }
    },
    prune: (maxAgeMs) => {
      try {
        if (!existsSync(dir)) return;
        const cutoff = Date.now() - maxAgeMs;
        for (const name of readdirSync(dir)) {
          const path = join(dir, name);
          if (statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
        }
      } catch (error) {
        reportOnce(`could not prune session state: ${(error as Error).message}`);
      }
    },
  };
};

export type GuardOptions = { requireMainBranch?: boolean };

type MainCheckout = { root: string; real: string };

const denialFor = (landing: Landing, main: MainCheckout, registered: string[]): string | undefined => {
  const { command, directory, named, namedTarget, redirect, reason } = landing;
  if (reason) return `  \`${command}\` is ${reason}.`;
  if (!directory) {
    return namedTarget
      ? `  \`${command}\` names ${namedTarget}, which does not exist or cannot be resolved.`
      : `  \`${command}\` runs in a directory this hook cannot resolve.`;
  }
  if (registered.some((root) => isWithin(directory, root))) return undefined;
  if (redirect) return `  \`${command}\` targets ${directory} through ${redirect}, which is the main checkout.`;
  const checkout = findCheckout(directory);
  if (!checkout) return `  \`${command}\` would run in ${directory}, which is not a git checkout.`;
  if (checkout.isMain && isWithin(directory, main.real)) {
    if (named && (isWithin(named, main.root) || isWithin(named, main.real))) return undefined;
    return named
      ? `  \`${command}\` would run in the main checkout through ${named}, which is not its own absolute path.`
      : `  \`${command}\` would run in ${directory}, the main checkout, reached by a relative path.`;
  }
  return `  \`${command}\` would run in ${directory}, which is neither this repository's main checkout nor one of its registered worktrees.`;
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
  if (!worktree || !isDirectory(worktree)) return undefined;
  const registered = registeredWorktrees(checkout.root);
  const worktreeReal = realpathSync(worktree);
  if (!registered.some((root) => isWithin(worktreeReal, root))) return undefined;
  const branch = currentBranch(checkout.root);
  if (requireMainBranch && branch !== defaultBranch(checkout.root)) return undefined;

  const landings = mutationsIn(command, input.cwd);
  if (landings.length === 0) return undefined;
  const main = { root: checkout.root, real: realpathSync(checkout.root) };
  const denied = landings.filter((landing) => denialFor(landing, main, registered));
  if (denied.length === 0) return undefined;

  return [
    `This session has been working in the worktree ${worktree}, but the Bash cwd is now the MAIN checkout (${checkout.root}, branch ${branch}) — the session cwd resets to main between calls.`,
    ...denied.map((landing) => denialFor(landing, main, registered)),
    'Dependency changes, commits, pushes, merges, worktree registry changes, and new migrations would land on main. Run it from the worktree:',
    ...denied.map((landing) => `  cd ${worktree} && ${landing.command}`),
    `If the main checkout really is the target, name it by its own absolute path: cd ${checkout.root} && ${denied[0].command}`,
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
    reportOnce(`failed open: ${(error as Error).message}`);
  }
}
