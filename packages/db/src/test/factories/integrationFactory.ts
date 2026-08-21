/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { IntegrationOwnerModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const integrationFactory = createFactory('Integration', {
  defaults: () => ({
    ownerModel: IntegrationOwnerModel.User,
    name: faker.company.name(),
  }),
});

export const buildIntegration = integrationFactory.build;
export const createIntegration = integrationFactory.create;
