/**
 * @atlas
 * @kind registry
 * @partOf primitive:flows
 * @uses none
 */
import { ArrayOperator } from '@inixiative/json-rules';
import { InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import { bindingsSchema } from '#/modules/flow/definitions/setUpOrganization/bindingsSchema';
import type { FlowDefinition } from '#/modules/flow/definitions/types';

const anyRow = { field: 'data', arrayOperator: ArrayOperator.notEmpty } as const;

export const setUpOrganizationFlow: FlowDefinition<typeof bindingsSchema> = {
  key: 'setUpOrganization',
  bindingsSchema,
  steps: ({ organizationId }) => {
    const tokensNamed = (name: string) => ({
      operationId: 'organizationReadManyTokens',
      path: { id: organizationId },
      query: { searchFields: { name: { contains: name } } },
    });

    return [
      {
        key: 'inviteTeammate',
        label: 'Invite a teammate',
        to: `/users/members?org=${organizationId}#invite`,
        advance: 'auto',
        read: {
          operationId: 'organizationSentManyInquiries',
          path: { id: organizationId },
          query: {
            searchFields: {
              type: InquiryType.inviteOrganizationUser,
              status: InquiryStatus.sent,
            },
          },
        },
        rule: anyRow,
      },
      {
        key: 'createCiToken',
        label: 'Create an API token for CI',
        to: `/settings/tokens?org=${organizationId}#create-token`,
        advance: 'confirm',
        read: tokensNamed('ci'),
        rule: anyRow,
      },
      {
        key: 'createLocalToken',
        label: 'Create one for local development',
        to: `/settings/tokens?org=${organizationId}#create-token`,
        advance: 'confirm',
        read: tokensNamed('local'),
        rule: anyRow,
      },
    ];
  },
};
