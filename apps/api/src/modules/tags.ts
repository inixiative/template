/**
 * @atlas
 * @kind constant
 * @uses none
 */
import { Modules } from '#/modules/modules';

export const Tags = {
  ...Modules,
  // Integrations
  // stripe: 'stripe',
  admin: 'admin',
  internal: 'internal',
} as const;

export type Tag = (typeof Tags)[keyof typeof Tags];
