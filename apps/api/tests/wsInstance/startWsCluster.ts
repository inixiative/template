import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  WS_INSTANCE_REPLY,
  type WSInstanceCommand,
  type WSInstanceReply,
} from '#tests/wsInstance/protocol';

const API_ROOT = join(import.meta.dir, '..', '..');
const REDIS_IMAGE = 'redis:7-alpine';
const REDIS_READY_TIMEOUT_MS = 15_000;
const OWNER_LABEL = 'template.ws-cluster.owner-pid';

export type WSInstance = {
  send: (command: WSInstanceCommand) => Promise<unknown>;
  frames: (connectionId: string) => Promise<Record<string, unknown>[]>;
};

export type WSCluster = {
  instance: (name: string, options?: { subscribes?: boolean }) => Promise<WSInstance>;
  stop: () => Promise<void>;
};

const resolveDocker = (): string => {
  const candidates = [
    Bun.which('docker'),
    join(homedir(), '.docker/bin/docker'),
    '/Applications/Docker.app/Contents/Resources/bin/docker',
  ];
  const docker = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!docker) throw new Error('The multi-instance websocket tests need docker for a real Redis.');
  return docker;
};

const runDocker = async (docker: string, args: string[]): Promise<string> => {
  const proc = Bun.spawn([docker, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`docker ${args.join(' ')} failed: ${err.trim()}`);
  return out.trim();
};

const waitForRedis = async (docker: string, container: string): Promise<void> => {
  const deadline = Date.now() + REDIS_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ping = await runDocker(docker, ['exec', container, 'redis-cli', 'ping']).catch(() => '');
    if (ping === 'PONG') return;
    await Bun.sleep(100);
  }
  throw new Error('Redis did not come up for the multi-instance websocket tests.');
};

const readReplies = async (
  stdout: ReadableStream<Uint8Array>,
  onReply: (reply: WSInstanceReply) => void,
): Promise<void> => {
  const decoder = new TextDecoder();
  let buffered = '';
  for await (const chunk of stdout) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith(WS_INSTANCE_REPLY))
        onReply(JSON.parse(line.slice(WS_INSTANCE_REPLY.length)));
    }
  }
};

const spawnInstance = async (
  name: string,
  redisUrl: string,
  subscribes: boolean,
  track: (kill: () => void) => void,
): Promise<WSInstance> => {
  const proc = Bun.spawn([process.execPath, join(import.meta.dir, 'instance.ts')], {
    cwd: API_ROOT,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ENVIRONMENT: 'local',
      NODE_ENV: 'development',
      LOG_LEVEL: 'error',
      REDIS_URL: redisUrl,
      WS_INSTANCE_SUBSCRIBES: String(subscribes),
    },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  track(() => proc.kill());

  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();
  let nextId = 0;
  let exitError: Error | undefined;
  const ready = Promise.withResolvers<void>();

  void readReplies(proc.stdout, (reply) => {
    if ('ready' in reply) return ready.resolve();
    const waiter = pending.get(reply.id);
    pending.delete(reply.id);
    if ('error' in reply) waiter?.reject(new Error(`${name}: ${reply.error}`));
    else waiter?.resolve(reply.result);
  });
  const stderr = new Response(proc.stderr).text();
  void proc.exited.then(async (code) => {
    exitError = new Error(`${name} exited (${code}):\n${await stderr}`);
    ready.reject(exitError);
    for (const waiter of pending.values()) waiter.reject(exitError);
    pending.clear();
  });

  await ready.promise;

  const send = (command: WSInstanceCommand): Promise<unknown> => {
    if (exitError) return Promise.reject(exitError);
    const id = nextId++;
    const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    proc.stdin.write(`${JSON.stringify({ id, command })}\n`);
    proc.stdin.flush();
    return result;
  };

  return {
    send,
    frames: (connectionId) =>
      send({ op: 'frames', connectionId }) as Promise<Record<string, unknown>[]>,
  };
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const removeOrphanedContainers = async (docker: string): Promise<void> => {
  const listed = await runDocker(docker, [
    'ps',
    '-a',
    '--filter',
    `label=${OWNER_LABEL}`,
    '--format',
    `{{.ID}} {{.Label "${OWNER_LABEL}"}}`,
  ]);
  const orphans = listed
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(' '))
    .filter(([, owner]) => !isAlive(Number(owner)))
    .map(([id]) => id as string);
  if (orphans.length > 0) await runDocker(docker, ['rm', '-f', ...orphans]);
};

export const startWsCluster = async (): Promise<WSCluster> => {
  const docker = resolveDocker();
  await removeOrphanedContainers(docker);
  const container = await runDocker(docker, [
    'run',
    '-d',
    '--rm',
    '--label',
    `${OWNER_LABEL}=${process.pid}`,
    '-p',
    '127.0.0.1::6379',
    REDIS_IMAGE,
  ]);
  const kills: (() => void)[] = [];

  const stop = async () => {
    for (const kill of kills) kill();
    await runDocker(docker, ['rm', '-f', container]).catch(() => undefined);
  };

  try {
    await waitForRedis(docker, container);
    const hostPort = (await runDocker(docker, ['port', container, '6379']))
      .split('\n')[0]
      ?.split(':')
      .pop();
    const redisUrl = `redis://127.0.0.1:${hostPort}`;

    return {
      instance: (name, { subscribes = true } = {}) =>
        spawnInstance(name, redisUrl, subscribes, (kill) => kills.push(kill)),
      stop,
    };
  } catch (err) {
    await stop();
    throw err;
  }
};
