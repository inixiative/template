import { createFactory, getNextSeq } from '@template/db/test/factory';

const emailComponentFactory = createFactory('EmailComponent', {
  defaults: () => ({
    slug: `component-${getNextSeq()}`,
    locale: 'en',
    mjml: '<mj-text>Default content</mj-text>',
    ownerModel: 'default' as const,
    componentRefs: [],
    inheritToSpaces: true,
  }),
});

export const buildEmailComponent = emailComponentFactory.build;
export const createEmailComponent = emailComponentFactory.create;
