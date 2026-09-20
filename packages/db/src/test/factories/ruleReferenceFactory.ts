/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { RuleReferenceOwnerModel, RuleReferenceReferencedModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const ruleReferenceFactory = createFactory('RuleReference', {
  defaults: () => ({
    ownerModel: RuleReferenceOwnerModel.EmailTemplate,
    referencedModel: RuleReferenceReferencedModel.Tag,
    referencedId: '',
  }),
  dependencies: {
    emailTemplate: { modelName: 'EmailTemplate', foreignKey: { id: 'emailTemplateId' }, required: false },
    emailComponent: { modelName: 'EmailComponent', foreignKey: { id: 'emailComponentId' }, required: false },
    segment: { modelName: 'Segment', foreignKey: { id: 'segmentId' }, required: false },
    tag: { modelName: 'Tag', foreignKey: { id: 'tagId' }, required: false },
    organization: { modelName: 'Organization', foreignKey: { id: 'organizationId' }, required: false },
    space: { modelName: 'Space', foreignKey: { id: 'spaceId' }, required: false },
    referencedSegment: { modelName: 'Segment', foreignKey: { id: 'referencedSegmentId' }, required: false },
  },
});

export const buildRuleReference = ruleReferenceFactory.build;
export const createRuleReference = ruleReferenceFactory.create;
