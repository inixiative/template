/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses primitive:shared
 */

import type { OpenAPIHono } from '@hono/zod-openapi';
import {
  type BatchInterpolationReference,
  type BatchInterpolationToken,
  decodePercentEncodedBatchReferences,
  tokenizeBatchInterpolation,
} from '@template/shared/batchInterpolation';
import { isValidPathNotation } from '#/lib/prisma/pathNotation';
import { assertBatchable } from '#/modules/batch/services/assertBatchable';
import type { BatchRequest } from '#/modules/batch/services/strategies/types';
import type { AppEnv } from '#/types/appEnv';

type InterpolationContext = {
  results: unknown[][];
  currentRound?: number;
};

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

const navigateFieldPath = (value: unknown, path: string): unknown => {
  const parts = path.split('.');
  let result = value;
  for (const part of parts) {
    if (FORBIDDEN_KEYS.includes(part)) {
      throw new Error(`Forbidden field access: ${part}`);
    }
    if (result === null || result === undefined) {
      return undefined;
    }
    const container: Record<string, unknown> = Object(result);
    if (!Object.hasOwn(container, part)) {
      return undefined;
    }
    result = container[part];
  }
  return result;
};

const referenceValue = (
  { raw, round, request, fieldPath }: BatchInterpolationReference,
  context: InterpolationContext,
): unknown => {
  if (!isValidPathNotation(fieldPath)) {
    throw new Error(`Invalid interpolation path: ${raw}`);
  }

  if (context.currentRound !== undefined && round >= context.currentRound) {
    throw new Error(
      `Invalid round reference in ${raw}: cannot reference round ${round} from round ${context.currentRound}. Interpolation can only reference previous rounds (0-${context.currentRound - 1})`,
    );
  }

  if (round >= context.results.length) {
    throw new Error(
      `Round index out of bounds in ${raw}: round ${round} does not exist (only ${context.results.length} rounds completed)`,
    );
  }

  if (!context.results[round]) {
    throw new Error(`Round ${round} has no results in ${raw}`);
  }

  if (request >= context.results[round].length) {
    throw new Error(
      `Request index out of bounds in ${raw}: request ${request} does not exist in round ${round} (only ${context.results[round].length} requests completed)`,
    );
  }

  if (!context.results[round][request]) {
    throw new Error(`Request ${request} in round ${round} has no result in ${raw}`);
  }

  const result = navigateFieldPath(context.results[round][request], fieldPath);

  if (result === undefined) {
    throw new Error(
      `Field not found in interpolation: ${raw} - field '${fieldPath}' does not exist in the result`,
    );
  }

  return result;
};

const referenceString = (
  reference: BatchInterpolationReference,
  context: InterpolationContext,
): string => String(referenceValue(reference, context));

const renderTokens = (
  tokens: BatchInterpolationToken[],
  context: InterpolationContext,
  encodeResolved: (resolved: string) => string = (resolved) => resolved,
): string =>
  tokens
    .map((token) =>
      token.kind === 'text' ? token.value : encodeResolved(referenceString(token, context)),
    )
    .join('');

const interpolateString = (
  value: string,
  context: InterpolationContext,
  encodeResolved?: (resolved: string) => string,
): string => renderTokens(tokenizeBatchInterpolation(value), context, encodeResolved);

const DOT_SEGMENTS = ['.', '..'];

const encodeResolvedPathValue = (resolved: string): string => {
  if (DOT_SEGMENTS.includes(resolved))
    throw new Error(`Batch reference resolved to '${resolved}', which cannot fill a path`);
  return encodeURIComponent(resolved);
};

const interpolatePath = (path: string, context: InterpolationContext): string =>
  interpolateString(decodePercentEncodedBatchReferences(path), context, encodeResolvedPathValue);

const interpolateHeaders = (
  headers: Record<string, string>,
  context: InterpolationContext,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, interpolateString(value, context)]),
  );

export const interpolateValue = (value: unknown, context: InterpolationContext): unknown => {
  if (typeof value === 'string') {
    const tokens = tokenizeBatchInterpolation(value);
    if (tokens.length === 1 && tokens[0]?.kind === 'reference') {
      return referenceValue(tokens[0], context);
    }
    return renderTokens(tokens, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, context));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = interpolateValue(val, context);
    }
    return result;
  }

  return value;
};

export const interpolateRequest = (
  request: BatchRequest,
  context: InterpolationContext,
): BatchRequest => {
  return {
    ...request,
    path: interpolatePath(request.path, context),
    body: request.body !== undefined ? interpolateValue(request.body, context) : undefined,
    headers: request.headers ? interpolateHeaders(request.headers, context) : undefined,
  };
};

export const interpolateBatchableRequest = (
  app: OpenAPIHono<AppEnv>,
  request: BatchRequest,
  context: InterpolationContext,
): BatchRequest => {
  const interpolatedRequest = interpolateRequest(request, context);
  assertBatchable(app, [[interpolatedRequest]]);
  return interpolatedRequest;
};
