/**
 * @atlas
 * @kind registry
 * @partOf primitive:flows
 * @uses none
 */
import { DateOperator, Operator } from '@inixiative/json-rules';
import { bindingsSchema } from '#/modules/flow/definitions/setUpOrganization/bindingsSchema';
import type { FlowDefinition } from '#/modules/flow/definitions/types';

const organization = { id: { bind: 'organizationId' } };
const inOrganization = { org: { bind: 'organizationId' } };
const sinceFlowStarted = {
  field: 'createdAt',
  dateOperator: DateOperator.onOrAfter,
  bind: 'flowStartedAt',
};

export const setUpOrganizationFlow: FlowDefinition = {
  key: 'setUpOrganization',
  bindingsSchema,
  steps: [
    {
      key: 'inviteTeammate',
      label: 'Invite a teammate',
      mode: 'navigate',
      to: '/users/members',
      search: inOrganization,
      hash: 'invite',
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: organization,
        rule: {
          all: [
            { field: 'type', operator: Operator.equals, value: 'inviteOrganizationUser' },
            { field: 'status', operator: Operator.equals, value: 'sent' },
          ],
        },
      },
    },
    {
      key: 'createCiToken',
      label: 'Create an API token for CI',
      mode: 'navigate',
      to: '/settings/tokens',
      search: inOrganization,
      hash: 'create-token',
      completedWhen: {
        read: 'organizationReadManyTokens',
        path: organization,
        rule: {
          all: [sinceFlowStarted, { field: 'name', operator: Operator.contains, value: 'ci' }],
        },
      },
    },
    {
      key: 'createLocalToken',
      label: 'Create one for local development',
      mode: 'anchor',
      to: '/settings/tokens',
      search: inOrganization,
      hash: 'create-token',
      completedWhen: {
        read: 'organizationReadManyTokens',
        path: organization,
        rule: {
          all: [sinceFlowStarted, { field: 'name', operator: Operator.contains, value: 'local' }],
        },
      },
    },
  ],
};
