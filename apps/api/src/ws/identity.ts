/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses none
 */
import { isEqual } from 'lodash-es';
import type { WSHeaders } from '#/ws/probe';
import { byUser, deindexFrom, indexInto } from '#/ws/registry';
import { unsubscribeFromStream } from '#/ws/streamSubscriptions';
import { unsubscribeFromChannel } from '#/ws/subscriptions';
import type { WSSocket } from '#/ws/types';

// Grants were authorized under the previous credential, so any change of user or credential drops them.
export const setIdentity = (ws: WSSocket, userId: string | null, headers: WSHeaders): void => {
  const prev = ws.data.userId;
  const unchanged = prev === userId && isEqual(ws.data.headers, headers);
  ws.data.headers = headers;
  if (unchanged) return;
  if (prev) deindexFrom(byUser, prev, ws.data.connectionId);
  for (const channel of [...ws.data.channels]) unsubscribeFromChannel(ws, channel);
  for (const stream of [...ws.data.streams]) unsubscribeFromStream(ws, stream);
  ws.data.userId = userId;
  if (userId) indexInto(byUser, userId, ws.data.connectionId);
};
