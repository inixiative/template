import { getRedisPub, getRedisSub } from '@template/db';
import { appendToStream, initWebSocketPubSub } from '#/ws/pubsub';
import { addConnection } from '#/ws/registry';
import { subscribeToStream } from '#/ws/streamSubscriptions';
import { createTestSocket, type TestSocketHandle } from '#tests/createTestSocket';
import {
  WS_INSTANCE_REPLY,
  type WSInstanceCommand,
  type WSInstanceReply,
} from '#tests/wsInstance/protocol';

const sockets = new Map<string, TestSocketHandle>();

const hold = ({ connectionId, stream, userId }: Extract<WSInstanceCommand, { op: 'hold' }>) => {
  const handle = sockets.get(connectionId) ?? createTestSocket({ connectionId, userId });
  sockets.set(connectionId, handle);
  addConnection(handle.socket);
  subscribeToStream(handle.socket, stream);
};

const append = ({ stream, ids, userIds }: Extract<WSInstanceCommand, { op: 'append' }>) =>
  Promise.all(
    ids.map((id) => appendToStream(stream, { type: 'upsert', payload: { id } }, userIds)),
  );

const dropSubscriber = async (downMs: number) => {
  const sub = getRedisSub();
  const retryStrategy = sub.options.retryStrategy;
  sub.options.retryStrategy = () => downMs;
  const reconnected = new Promise((resolve) => sub.once('ready', resolve));
  sub.disconnect(true);
  await reconnected;
  sub.options.retryStrategy = retryStrategy;
};

const failAppends = (count: number) => {
  const redis = getRedisPub();
  const evaluate = redis.eval.bind(redis);
  let remaining = count;
  redis.eval = ((...args: Parameters<typeof evaluate>) =>
    remaining-- > 0
      ? Promise.reject(new Error('eval refused'))
      : evaluate(...args)) as typeof redis.eval;
};

const run = async (command: WSInstanceCommand): Promise<unknown> => {
  switch (command.op) {
    case 'hold':
      return hold(command);
    case 'append':
      return append(command);
    case 'frames':
      return (sockets.get(command.connectionId)?.sent ?? []).map((frame) => JSON.parse(frame));
    case 'dropSubscriber':
      return dropSubscriber(command.downMs);
    case 'failAppends':
      return failAppends(command.count);
  }
};

const reply = (message: WSInstanceReply) =>
  process.stdout.write(`${WS_INSTANCE_REPLY}${JSON.stringify(message)}\n`);

if (process.env.WS_INSTANCE_SUBSCRIBES === 'true') await initWebSocketPubSub();
await getRedisPub().ping();
reply({ ready: true });

for await (const line of console) {
  const { id, command } = JSON.parse(line) as { id: number; command: WSInstanceCommand };
  try {
    reply({ id, result: (await run(command)) ?? null });
  } catch (err) {
    reply({ id, error: String(err) });
  }
}
