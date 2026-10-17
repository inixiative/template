/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses none
 */
import { validatePathNotation } from '#/lib/prisma/pathNotation';
import type { BatchRequest } from '#/modules/batch/services/strategies/types';

const INTERPOLATION_PATTERN = /<<(\d+)\.(\d+)\.([a-zA-Z0-9_.]+)>>/;
const INTERPOLATION_PATTERN_GLOBAL = /<<(\d+)\.(\d+)\.([a-zA-Z0-9_.]+)>>/g;
const MALFORMED_PATTERN_REGEX = /<<[^>]*>>/g;

type InterpolationContext = {
  results: unknown[][];
  currentRound?: number;
};

const validateInterpolationSyntax = (value: string): void => {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '<' && value[i + 1] === '<') {
      depth++;
      if (depth > 1) {
        throw new Error('Nested interpolation is not allowed');
      }
      i++;
    } else if (value[i] === '>' && value[i + 1] === '>') {
      depth--;
      if (depth < 0) {
        throw new Error('Unbalanced interpolation brackets: closing >> without opening <<');
      }
      i++;
    }
  }
  if (depth !== 0) {
    throw new Error('Unbalanced interpolation brackets: unclosed <<');
  }

  const malformedPatterns = value.match(MALFORMED_PATTERN_REGEX);
  if (!malformedPatterns) return;

  for (const pattern of malformedPatterns) {
    if (!INTERPOLATION_PATTERN.test(pattern)) {
      throw new Error(
        `Malformed interpolation syntax: ${pattern}. Expected format: <<roundIndex.requestIndex.field.path>>`,
      );
    }
  }
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

const interpolateString = (value: string, context: InterpolationContext): string => {
  validateInterpolationSyntax(value);

  return value.replace(
    INTERPOLATION_PATTERN_GLOBAL,
    (match: string, roundIdx: string, reqIdx: string, fieldPath: string) => {
      if (!validatePathNotation(fieldPath)) {
        throw new Error(`Invalid interpolation path: ${match}`);
      }

      const round = parseInt(roundIdx, 10);
      const request = parseInt(reqIdx, 10);

      if (context.currentRound !== undefined && round >= context.currentRound) {
        throw new Error(
          `Invalid round reference in ${match}: cannot reference round ${round} from round ${context.currentRound}. Interpolation can only reference previous rounds (0-${context.currentRound - 1})`,
        );
      }

      if (round >= context.results.length) {
        throw new Error(
          `Round index out of bounds in ${match}: round ${round} does not exist (only ${context.results.length} rounds completed)`,
        );
      }

      if (!context.results[round]) {
        throw new Error(`Round ${round} has no results in ${match}`);
      }

      if (request >= context.results[round].length) {
        throw new Error(
          `Request index out of bounds in ${match}: request ${request} does not exist in round ${round} (only ${context.results[round].length} requests completed)`,
        );
      }

      if (!context.results[round][request]) {
        throw new Error(`Request ${request} in round ${round} has no result in ${match}`);
      }

      const result = navigateFieldPath(context.results[round][request], fieldPath);

      if (result === undefined) {
        throw new Error(
          `Field not found in interpolation: ${match} - field '${fieldPath}' does not exist in the result`,
        );
      }

      return String(result);
    },
  );
};

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
    path: interpolateString(request.path, context),
    body: request.body ? interpolateValue(request.body, context) : undefined,
    headers: request.headers ? interpolateHeaders(request.headers, context) : undefined,
  };
};
