/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { z } from 'zod';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CUSTOM_FLAG_PREFIX = 'custom:';

export const isSlug = (value: string): boolean => SLUG_RE.test(value);

export const slugSchema = z.string().refine(isSlug, { message: 'lowercase letters, digits and single hyphens only' });

export const toSlug = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const keepSlugCharacters = (raw: string): string => raw.toLowerCase().replace(/[^a-z0-9-]/g, '');

export const isCustomFlagSlug = (slug: string): boolean => slug.startsWith(CUSTOM_FLAG_PREFIX);

export const isFeatureFlagSlug = (value: string): boolean =>
  isSlug(isCustomFlagSlug(value) ? value.slice(CUSTOM_FLAG_PREFIX.length) : value);

export const featureFlagSlugSchema = z.string().refine(isFeatureFlagSlug, {
  message: `a slug, optionally prefixed ${CUSTOM_FLAG_PREFIX}`,
});
