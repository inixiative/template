/**
 * @atlas
 * @kind registry
 * @partOf primitive:flows
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { paramsSchema } from '#/modules/flow/definitions/setUpOrganization/schema';
import type { FlowDefinition } from '#/modules/flow/definitions/types';

const sentInvites: Condition = {
  all: [
    { field: 'type', operator: Operator.equals, value: 'inviteOrganizationUser' },
    { field: 'status', operator: Operator.equals, value: 'sent' },
  ],
};

export const setUpOrganizationFlow: FlowDefinition = {
  key: 'setUpOrganization',
  paramsSchema,
  steps: [
    {
      key: 'inviteTeammate',
      label: 'Invite a teammate',
      url: '/users/members?org={{organizationId}}',
      mode: 'navigate',
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: { id: '{{organizationId}}' },
        where: sentInvites,
      },
    },
    {
      key: 'inviteAnother',
      label: 'Invite one more',
      url: '/users/members?org={{organizationId}}#invite',
      mode: 'anchor',
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: { id: '{{organizationId}}' },
        where: sentInvites,
        count: { atLeast: 2 },
      },
    },
    {
      key: 'createApiTokens',
      label: 'Create two API tokens: one for CI, one for local development',
      url: '/settings/tokens?org={{organizationId}}#create-token',
      mode: 'navigate',
      completedWhen: {
        read: 'organizationReadManyTokens',
        path: { id: '{{organizationId}}' },
        count: { atLeast: 2 },
      },
    },
  ],
};
