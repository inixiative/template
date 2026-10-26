/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses primitive:routeTemplates
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { makeError } from '#/lib/errors';
import type { BatchRequest } from '#/modules/batch/services/strategies/types';
import type { AppEnv } from '#/types/appEnv';

const segmentsOf = (path: string) =>
  new URL(path, 'http://batch').pathname.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

const isParam = (segment: string) => /^\{.+\}$/.test(segment);

// An interpolated segment resolves only once its round runs, so it may reach any route below it.
const couldReach = (requestPath: string, routePath: string) => {
  const route = segmentsOf(routePath);
  const requested = segmentsOf(requestPath);
  for (const [index, segment] of requested.entries()) {
    if (segment.includes('<<')) return true;
    const routeSegment = route[index];
    if (routeSegment === undefined) return false;
    if (!isParam(routeSegment) && routeSegment !== segment) return false;
  }
  return requested.length === route.length;
};

export const assertBatchable = (app: OpenAPIHono<AppEnv>, rounds: BatchRequest[][]) => {
  const unbatchable = app.openAPIRegistry.definitions.flatMap((definition) =>
    definition.type === 'route' && definition.route['x-batch'] === false ? [definition.route] : [],
  );
  for (const request of rounds.flat()) {
    const route = unbatchable.find(
      (candidate) =>
        candidate.method.toUpperCase() === request.method.toUpperCase() &&
        couldReach(request.path, candidate.path),
    );
    if (route)
      throw makeError({
        status: 400,
        message: `${route.method.toUpperCase()} ${route.path} cannot run in a batch`,
      });
  }
};
