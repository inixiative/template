/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const emailComponentFactory = registerFactory('EmailComponent', {
  defaults: () => ({
    slug: `component-${nextFactorySequenceNumber()}`,
    locale: 'en',
    mjml: '<mj-text>Default content</mj-text>',
    componentSlugs: [],
    inheritToSpaces: true,
  }),
});

export const buildEmailComponent = emailComponentFactory.build;
export const createEmailComponent = emailComponentFactory.create;
