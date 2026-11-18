/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const emailTemplateFactory = registerFactory('EmailTemplate', {
  defaults: () => ({
    slug: `template-${nextFactorySequenceNumber()}`,
    name: `Template ${nextFactorySequenceNumber()}`,
    locale: 'en',
    kind: 'system' as const,
    subject: 'Test Subject',
    mjml: '<mjml><mj-body><mj-text>Default</mj-text></mj-body></mjml>',
    componentSlugs: [],
    inheritToSpaces: true,
  }),
});

export const buildEmailTemplate = emailTemplateFactory.build;
export const createEmailTemplate = emailTemplateFactory.create;
