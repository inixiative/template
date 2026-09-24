/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { LogScope, log } from '@template/shared/logger';
import { makeUnrefInterval } from '#/lib/utils/makeUnrefInterval';
import { reauthorizeStreams } from '#/ws/reauthorizeStreams';
import { byId } from '#/ws/registry';
import type { WSSocket } from '#/ws/types';

const REAUTHORIZE_INTERVAL_MS = 45_000;

const pending = new WeakSet<WSSocket>();

const reauthorizeQueued = async (ws: WSSocket): Promise<void> => {
  pending.add(ws);
  try {
    await ws.data.queue.run(() => reauthorizeStreams(ws));
  } catch (err) {
    log.error(`ws stream re-authorization failed: ${err instanceof Error ? err.message : String(err)}`, LogScope.ws);
  } finally {
    pending.delete(ws);
  }
};

export const reauthorizeOpenStreams = async (): Promise<void> => {
  const sockets = [...byId.values()].filter((ws) => ws.data.streams.size > 0 && !pending.has(ws));
  await Promise.all(sockets.map(reauthorizeQueued));
};

const sweep = makeUnrefInterval({
  intervalMs: REAUTHORIZE_INTERVAL_MS,
  tick: () => void reauthorizeOpenStreams(),
});

export const startStreamReauthorizeSweep = sweep.start;
export const stopStreamReauthorizeSweep = sweep.stop;
