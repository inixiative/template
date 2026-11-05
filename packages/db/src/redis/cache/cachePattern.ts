/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching
 * @uses none
 */
import { escapeRegExp } from 'lodash-es';

export const isPattern = (key: string): boolean => key.includes('*');

export const matchesPattern = (pattern: string, key: string): boolean =>
  new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`).test(key);
