/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

/** Type guard for string[] (single source of truth across shared and db attribute layers). */
export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
