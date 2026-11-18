/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:appEvents
 */
import { db, type Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';

export const recordCommunicationOutcome = async (
  where: Prisma.CommunicationLogWhereInput,
  data: Prisma.CommunicationLogUpdateManyMutationInput,
): Promise<void> => {
  const [row] = await db.communicationLog.updateManyAndReturn({ where, data });
  if (row) await emitAppEvent('communication.outcomeRecorded', { communicationLog: row });
};
