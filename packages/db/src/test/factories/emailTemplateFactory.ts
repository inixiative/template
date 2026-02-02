import { createFactory, getNextSeq } from '../factory';

const emailTemplateFactory = createFactory('EmailTemplate', {
  defaults: () => ({
    slug: `template-${getNextSeq()}`,
    name: `Template ${getNextSeq()}`,
    locale: 'en',
    category: 'system' as const,
    subject: 'Test Subject',
    mjml: '<mjml><mj-body><mj-text>Default</mj-text></mj-body></mjml>',
    ownerModel: 'default' as const,
    componentRefs: [],
    inheritToSpaces: true,
  }),
});

export const buildEmailTemplate = emailTemplateFactory.build;
export const createEmailTemplate = emailTemplateFactory.create;
