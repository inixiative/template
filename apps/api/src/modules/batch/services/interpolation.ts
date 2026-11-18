/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses none
 */
import {
  type BatchInterpolationReference,
  decodePercentEncodedReferences,
  tokenizeBatchInterpolation,
} from '@template/shared/batchInterpolation';
import { isValidPathNotation } from '#/lib/prisma/pathNotation';
import type { BatchRequest } from '#/modules/batch/services/strategies/types';

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

const resolveReference = (
  { raw, round, request, fieldPath }: BatchInterpolationReference,
  context: InterpolationContext,
): string => {
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

  return String(result);
};

const interpolateString = (value: string, context: InterpolationContext): string =>
  tokenizeBatchInterpolation(value)
    .map((token) => (token.kind === 'text' ? token.value : resolveReference(token, context)))
    .join('');

const interpolateHeaders = (
  headers: Record<string, string>,
  context: InterpolationContext,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, interpolateString(value, context)]),
  );

export const interpolateValue = (value: unknown, context: InterpolationContext): unknown => {
  if (typeof value === 'string') {
    return interpolateString(value, context);
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
    path: interpolateString(decodePercentEncodedReferences(request.path), context),
    body: request.body ? interpolateValue(request.body, context) : undefined,
    headers: request.headers ? interpolateHeaders(request.headers, context) : undefined,
  };
};
