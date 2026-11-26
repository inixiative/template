/**
 * @atlas
 * @kind types
 * @partOf feature:inquiry
 * @uses none
 */
import type { ModelName } from '@template/db';

export type Repoint = { model: ModelName; column: string; from: string; to: string };

export type Row = Record<string, unknown> & { id: string; deletedAt?: Date | null };
