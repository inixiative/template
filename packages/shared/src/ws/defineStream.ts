/**
 * @atlas
 * @kind constructor
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 * @constructs streamDefinition
 */
import { channelKey } from '@template/shared/ws/channelKey';
import type { z } from 'zod';

export type StreamAudience = 'shared' | 'perRecipient';

export type StreamParamsSchema = z.ZodObject<Record<string, z.ZodString>>;

export type StreamActionSchemas = Record<string, z.ZodType>;

export type StreamDefinition<
  TFamily extends string = string,
  TParams extends StreamParamsSchema = StreamParamsSchema,
  TSnapshot extends z.ZodType = z.ZodType,
  TActions extends StreamActionSchemas = StreamActionSchemas,
  TAudience extends StreamAudience = StreamAudience,
> = {
  family: TFamily;
  audience: TAudience;
  params: TParams;
  snapshot: TSnapshot;
  actions: TActions;
  name: (params: z.input<TParams>) => string;
};

export type StreamParams<D extends StreamDefinition> = z.input<D['params']>;

export type StreamSnapshot<D extends StreamDefinition> = z.output<D['snapshot']>;

export type StreamActionType<D extends StreamDefinition> = keyof D['actions'] & string;

export type StreamActionPayload<D extends StreamDefinition, K extends StreamActionType<D>> = z.output<D['actions'][K]>;

export type StreamActionInput<D extends StreamDefinition, K extends StreamActionType<D>> = z.input<D['actions'][K]>;

export const defineStream = <
  const TFamily extends string,
  TParams extends StreamParamsSchema,
  TSnapshot extends z.ZodType,
  TActions extends StreamActionSchemas,
  TAudience extends StreamAudience,
>(
  family: TFamily,
  config: { audience: TAudience; params: TParams; snapshot: TSnapshot; actions: TActions },
): StreamDefinition<TFamily, TParams, TSnapshot, TActions, TAudience> => ({
  family,
  ...config,
  name: (params) => channelKey({ _id: family, path: config.params.parse(params) }),
});
