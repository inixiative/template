/**
 * @atlas
 * @kind type
 * @partOf feature:customerRelationship
 * @uses none
 */
import type { CustomerModel } from '@template/db/generated/client/enums';

export type CustomerReference = { customerModel: CustomerModel; customerId: string };
