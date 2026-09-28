/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */

import { parseChannelKey } from '@template/shared/ws/channelKey';
import { defineStream } from '@template/shared/ws/defineStream';
import { z } from 'zod';

export const STREAM_DEFINITIONS = {
  organizationReadManyContacts: defineStream('organizationReadManyContacts', {
    kind: 'list',
    audience: 'shared',
    params: z.object({ id: z.string() }),
  }),
} as const;

export type StreamFamily = keyof typeof STREAM_DEFINITIONS;

export type RegisteredStream = (typeof STREAM_DEFINITIONS)[StreamFamily];

export const streamDefinitionFor = (family: string): RegisteredStream | null =>
  Object.hasOwn(STREAM_DEFINITIONS, family) ? STREAM_DEFINITIONS[family as StreamFamily] : null;

export const streamDefinitionOf = (stream: string): RegisteredStream | null =>
  streamDefinitionFor(parseChannelKey(stream)._id);
