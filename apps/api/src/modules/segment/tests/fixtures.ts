import { Operator } from '@inixiative/json-rules';
import { db } from '@template/db';

export const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

export const memberIds = async (segmentId: string): Promise<string[]> =>
  (await db.segmentMember.findMany({ where: { segmentId } })).map((member) => member.customerRefId).sort();
