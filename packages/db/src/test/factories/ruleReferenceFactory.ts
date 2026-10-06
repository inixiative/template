/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  RuleReferenceSourceModel,
  RuleReferenceTargetModel,
} from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const ruleReferenceFactory = createFactory('RuleReference', {
  defaults: () => ({
    sourceModel: RuleReferenceSourceModel.EmailTemplate,
    targetModel: RuleReferenceTargetModel.Tag,
    targetId: '',
  }),
  dependencies: {
    sourceEmailTemplate: {
      modelName: 'EmailTemplate',
      foreignKey: { id: 'sourceEmailTemplateId' },
      required: false,
    },
    sourceEmailComponent: {
      modelName: 'EmailComponent',
      foreignKey: { id: 'sourceEmailComponentId' },
      required: false,
    },
    sourceSegment: {
      modelName: 'Segment',
      foreignKey: { id: 'sourceSegmentId' },
      required: false,
    },
    targetTag: {
      modelName: 'Tag',
      foreignKey: { id: 'targetTagId' },
      required: false,
    },
    targetOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'targetOrganizationId' },
      required: false,
    },
    targetSpace: {
      modelName: 'Space',
      foreignKey: { id: 'targetSpaceId' },
      required: false,
    },
    targetSegment: {
      modelName: 'Segment',
      foreignKey: { id: 'targetSegmentId' },
      required: false,
    },
  },
});

export const buildRuleReference = ruleReferenceFactory.build;
export const createRuleReference = ruleReferenceFactory.create;
