/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export const hasUnsafeSegment = (path: string): boolean =>
  path.split('.').some((segment) => UNSAFE_PATH_SEGMENTS.has(segment));
