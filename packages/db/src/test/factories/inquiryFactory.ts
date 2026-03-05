import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const inquiryFactory = createFactory('Inquiry', {
  defaults: () => ({
    type: InquiryType.inviteOrganizationUser,
    status: InquiryStatus.sent,
    sourceModel: InquiryResourceModel.Organization,
    targetModel: InquiryResourceModel.User,
    content: {},
    resolution: {},
  }),
  dependencies: {
    sourceUser: {
      modelName: 'User',
      foreignKey: { id: 'sourceUserId' },
      required: false,
    },
    sourceOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'sourceOrganizationId' },
      required: false,
    },
    sourceSpace: {
      modelName: 'Space',
      foreignKey: { id: 'sourceSpaceId' },
      required: false,
    },
    targetUser: {
      modelName: 'User',
      foreignKey: { id: 'targetUserId' },
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
  },
});

export const buildInquiry = inquiryFactory.build;
export const createInquiry = inquiryFactory.create;
