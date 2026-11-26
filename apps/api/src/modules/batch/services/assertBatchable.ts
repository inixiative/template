/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses primitive:routeTemplates, primitive:shared
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { tokenizeBatchInterpolation } from '@template/shared/batchInterpolation';
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

const segmentHoldsBatchReference = (segment: string) => {
  try {
    return tokenizeBatchInterpolation(segment).some((token) => token.kind === 'reference');
  } catch {
    return true;
  }
};

const isParam = (segment: string) => /^\{.+\}$/.test(segment);

// An interpolated segment resolves only once its round runs, so it may reach any route below it.
const matchesRoute = (requestPath: string, routePath: string) => {
  const route = segmentsOf(routePath);
  const requested = segmentsOf(requestPath);
  for (const [index, segment] of requested.entries()) {
    if (segmentHoldsBatchReference(segment)) return true;
    const routeSegment = route[index];
    if (routeSegment === '*') return true;
    if (routeSegment === undefined) return false;
    if (!isParam(routeSegment) && routeSegment !== segment) return false;
  }
  return requested.length === route.length;
};

// Better Auth signs, revokes and resets credentials, and its endpoints never reach the registry.
const betterAuth = { method: '*', path: '/api/auth/*' };

export const assertBatchable = (app: OpenAPIHono<AppEnv>, rounds: BatchRequest[][]) => {
  const unbatchable = [
    betterAuth,
    ...app.openAPIRegistry.definitions.flatMap((definition) =>
      definition.type === 'route' && definition.route['x-forbid-batch'] === true
        ? [definition.route]
        : [],
    ),
  ];
  for (const request of rounds.flat()) {
    const route = unbatchable.find(
      (candidate) =>
        (candidate.method === '*' ||
          candidate.method.toUpperCase() === request.method.toUpperCase()) &&
        matchesRoute(request.path, candidate.path),
    );
    if (route)
      throw makeError({
        status: 400,
        message: `${route.method === '*' ? '' : `${route.method.toUpperCase()} `}${route.path} cannot run in a batch`,
      });
  }
};
