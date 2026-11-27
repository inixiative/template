/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type AccessorName, toAccessor } from '@template/db/utils/modelNames';

export const modelDelegate = (client: unknown, model: string): RuntimeDelegate =>
  (client as Record<AccessorName, RuntimeDelegate>)[toAccessor(model)];
