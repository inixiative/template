/**
 * @atlas
 * @kind constant
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { StandardAction } from '@template/permissions/client';

export const ARTIFACT_EDGE_AUTHORITY = {
  member: 'manage',
  container: 'operate',
} as const satisfies Record<'member' | 'container', StandardAction>;
