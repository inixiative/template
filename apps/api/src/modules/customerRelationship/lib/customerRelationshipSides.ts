/**
 * @atlas
 * @kind type
 * @partOf feature:customerRelationship
 * @uses none
 */
import type { CustomerModel, ProviderModel } from '@template/db/generated/client/enums';

export type CustomerSide = { customerModel: CustomerModel; customerId: string };

export type ProviderSide = { providerModel: ProviderModel; providerId: string };
