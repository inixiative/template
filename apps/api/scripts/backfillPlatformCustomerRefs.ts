/**
 * @atlas
 * @kind helper
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { LogScope, log } from '@template/shared/logger';
import { backfillPlatformCustomerRefs } from '#/modules/customerRef/services/backfillPlatformCustomerRefs';

const counts = await backfillPlatformCustomerRefs();
for (const [customerModel, count] of Object.entries(counts)) {
  log.info(
    `${customerModel}: ${count.created} created, ${count.revived} revived, ${count.present} present`,
    LogScope.db,
  );
}
process.exit(0);
