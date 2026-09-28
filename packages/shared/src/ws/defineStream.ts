/**
 * @atlas
 * @kind constructor
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 * @constructs streamDefinition
 */
import { channelKey } from '@template/shared/ws/channelKey';
import type { StreamKind, StreamOrdering } from '@template/shared/ws/streamOps';
import type { z } from 'zod';

export type StreamAudience = 'shared' | 'perRecipient';

export type StreamParamsSchema = z.ZodObject<Record<string, z.ZodString>>;

export type StreamDefinition<
  TFamily extends string = string,
  TKind extends StreamKind = StreamKind,
  TParams extends StreamParamsSchema = StreamParamsSchema,
  TAudience extends StreamAudience = StreamAudience,
  TOrdering extends StreamOrdering = StreamOrdering,
> = {
  family: TFamily;
  kind: TKind;
  audience: TAudience;
  ordering: TOrdering;
  params: TParams;
  name: (params: z.input<TParams>) => string;
};

export type StreamParams<D extends StreamDefinition> = z.input<D['params']>;

export const defineStream = <
  const TFamily extends string,
  const TKind extends StreamKind,
  TParams extends StreamParamsSchema,
  const TAudience extends StreamAudience,
  const TOrdering extends StreamOrdering = 'updatedAt',
>(
  family: TFamily,
  config: { kind: TKind; audience: TAudience; params: TParams; ordering?: TOrdering },
): StreamDefinition<TFamily, TKind, TParams, TAudience, TOrdering> => ({
  family,
  ...config,
  ordering: config.ordering ?? ('updatedAt' as TOrdering),
  name: (params) => channelKey({ _id: family, path: config.params.parse(params) }),
});
