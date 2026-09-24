/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma, primitive:websockets
 * @uses none
 */
import { organizationContactsStream } from '@template/db/streams/organizationContactsStream';

export const STREAM_DEFINITIONS = {
  [organizationContactsStream.family]: organizationContactsStream,
} as const;

export type StreamFamily = keyof typeof STREAM_DEFINITIONS;

export type RegisteredStream = (typeof STREAM_DEFINITIONS)[StreamFamily];

export const streamDefinitionFor = (family: string): RegisteredStream | null =>
  Object.hasOwn(STREAM_DEFINITIONS, family) ? STREAM_DEFINITIONS[family as StreamFamily] : null;
