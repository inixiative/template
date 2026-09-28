/**
 * @atlas
 * @kind constructor
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 * @constructs streamDefinition
 */
import { channelKey } from '@template/shared/ws/channelKey';
import type { StreamKind } from '@template/shared/ws/streamOps';
import type { z } from 'zod';

export type StreamAudience = 'shared' | 'perRecipient';

export type StreamParamsSchema = z.ZodObject<Record<string, z.ZodString>>;

export type StreamDefinition<
  TFamily extends string = string,
  TKind extends StreamKind = StreamKind,
  TParams extends StreamParamsSchema = StreamParamsSchema,
  TAudience extends StreamAudience = StreamAudience,
> = {
  family: TFamily;
  kind: TKind;
  audience: TAudience;
  params: TParams;
  name: (params: z.input<TParams>) => string;
};

export type StreamParams<D extends StreamDefinition> = z.input<D['params']>;

export const defineStream = <
  const TFamily extends string,
  const TKind extends StreamKind,
  TParams extends StreamParamsSchema,
  const TAudience extends StreamAudience,
>(
  family: TFamily,
  config: { kind: TKind; audience: TAudience; params: TParams },
): StreamDefinition<TFamily, TKind, TParams, TAudience> => ({
  family,
  ...config,
  name: (params) => channelKey({ _id: family, path: config.params.parse(params) }),
});
