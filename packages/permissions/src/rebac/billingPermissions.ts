/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import { BillingResourceTargetModel } from '@template/db/generated/client/enums';
import {
  actorMayPerformActionOnOwner,
  integrationAdministering,
} from '@template/permissions/rebac/rebacSchemaRules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { omit } from 'lodash-es';

const resourceModelEquals = (model: BillingResourceTargetModel): ActionRule => ({
  rule: { field: 'resourceModel', operator: Operator.equals, value: model },
});

const billingResourceTargetManage: ActionRule = {
  any: [
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.Space),
        { rel: 'resourceSpace', action: 'manage' },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.Project),
        { rel: 'resourceProject', action: 'manage' },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.ProjectIntegration),
        { rel: 'resourceProjectIntegration', action: 'manage' },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.OrganizationUser),
        {
          any: [
            { rel: 'resourceOrganizationUser', action: 'operate' },
            { rel: 'resourceOrganizationUser', action: 'manage' },
          ],
        },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.SpaceUser),
        {
          any: [
            { rel: 'resourceSpaceUser', action: 'operate' },
            { rel: 'resourceSpaceUser', action: 'manage' },
          ],
        },
      ],
    },
  ],
};

const billingResourceTargetRead: ActionRule = {
  any: [
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.Space),
        { rel: 'resourceSpace', action: 'read' },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.Project),
        { rel: 'resourceProject', action: 'read' },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.ProjectIntegration),
        { rel: 'resourceProjectIntegration', action: 'read' },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.OrganizationUser),
        {
          any: [
            { rel: 'resourceOrganizationUser', action: 'operate' },
            { rel: 'resourceOrganizationUser', action: 'read' },
          ],
        },
      ],
    },
    {
      all: [
        resourceModelEquals(BillingResourceTargetModel.SpaceUser),
        {
          any: [
            { rel: 'resourceSpaceUser', action: 'operate' },
            { rel: 'resourceSpaceUser', action: 'read' },
          ],
        },
      ],
    },
  ],
};

export const billingAccountResourcePermission: ResourcePermission = {
  actions: {
    ...omit(integrationAdministering, ['delegateFull', 'delete']),
    delete: 'manage',
    operate: {
      any: [
        'manage',
        {
          all: [
            { rule: { field: 'isShared', operator: Operator.equals, value: true } },
            actorMayPerformActionOnOwner('operate', '', ['Organization', 'Space']),
          ],
        },
      ],
    },
    read: 'operate',
  },
};

export const billingResourceResourcePermission: ResourcePermission = {
  actions: {
    create: {
      all: [{ rel: 'billingAccount', action: 'operate' }, billingResourceTargetManage],
    },
    manage: billingResourceTargetManage,
    delete: {
      any: [{ rel: 'billingAccount', action: 'manage' }, billingResourceTargetManage],
    },
    read: {
      any: ['manage', { rel: 'billingAccount', action: 'read' }, billingResourceTargetRead],
    },
  },
};
