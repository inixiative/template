/**
 * @atlas
 * @kind constant
 * @uses none
 */
import { Modules } from '#/modules/modules';

export const OpenApiTags = {
  ...Modules,
  // Integrations
  // stripe: 'stripe',
  admin: 'admin',
  internal: 'internal',
} as const;

export type OpenApiTag = (typeof OpenApiTags)[keyof typeof OpenApiTags];
