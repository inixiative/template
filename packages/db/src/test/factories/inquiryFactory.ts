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
    sourceOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'sourceOrganizationId' },
      required: false,
    },
    targetUser: {
      modelName: 'User',
      foreignKey: { id: 'targetUserId' },
      required: false,
    },
  },
});

export const buildInquiry = inquiryFactory.build;
export const createInquiry = inquiryFactory.create;
