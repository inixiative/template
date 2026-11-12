/**
 * @atlas
 * @kind registry
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { ArrayOperator } from '@inixiative/json-rules';
import { InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import { FlowStepAdvance } from '@template/shared/flows';
import { appPathSchema, uuidV7Schema } from '@template/shared/utils';
import { z } from 'zod';
import { apiPath } from '#/lib/openapi/apiPath';
import type { FlowDefinition } from '#/modules/flow/registry/flowRegistry';

const bindingsSchema = z.strictObject({
  organizationId: uuidV7Schema,
  returnUrl: appPathSchema.optional(),
});

const anyRow = { field: 'data', arrayOperator: ArrayOperator.notEmpty } as const;

export const setUpOrganizationFlow: FlowDefinition<typeof bindingsSchema> = {
  key: 'setUpOrganization',
  bindingsSchema,
  steps: async ({ organizationId }) => {
    const organization = { id: organizationId };
    const tokensNamed = (name: string) =>
      apiPath('organizationReadManyTokens', organization, {
        searchFields: { name: { contains: name } },
      });
    const tokensPage = `/settings/tokens?org=${organizationId}#create-token`;

    return [
      {
        key: 'inviteTeammate',
        label: 'Invite a teammate',
        to: `/users/members?org=${organizationId}#invite`,
        advance: FlowStepAdvance.auto,
        readPath: await apiPath('organizationSentManyInquiries', organization, {
          searchFields: { type: InquiryType.inviteOrganizationUser, status: InquiryStatus.sent },
        }),
        rule: anyRow,
      },
      {
        key: 'createCiToken',
        label: 'Create an API token for CI',
        to: tokensPage,
        advance: FlowStepAdvance.confirm,
        readPath: await tokensNamed('ci'),
        rule: anyRow,
      },
      {
        key: 'createLocalToken',
        label: 'Create one for local development',
        to: tokensPage,
        advance: FlowStepAdvance.confirm,
        readPath: await tokensNamed('local'),
        rule: anyRow,
      },
    ];
  },
};
