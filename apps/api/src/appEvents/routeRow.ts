/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:routeTemplates, primitive:websockets
 */
import type { z } from 'zod';

declare const shapedByRoute: unique symbol;

export type RouteRow<T> = T & { readonly [shapedByRoute]: true };

export const routeRow = <S extends z.ZodType>(
  route: { responseSchema: S },
  value: unknown,
): RouteRow<z.output<S>> => route.responseSchema.parse(value) as RouteRow<z.output<S>>;
