/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz, feature:integrations
 * @uses none
 */
import type { Action, Transition } from '@inixiative/transitions';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import {
  actingAsAPerson,
  actingAsTheRecordsIntegration,
} from '@template/permissions/rebac/rebacSchemaRules';
import type { ActionRule } from '@template/permissions/rebac/types';
import { creating, fieldIs, notDeleted, updating } from '@template/permissions/transitions/utils';

const { tracked, missing, untracked } = IntegrationResourceStatus;

const byAPerson: ActionRule = { all: ['manage', actingAsAPerson] };
const byItsIntegration: ActionRule = { all: ['manage', actingAsTheRecordsIntegration] };

const statusPaths: Transition[] = [
  {
    from: { predicate: { all: [updating, fieldIs('status', tracked)] }, permission: 'manage' },
    to: { predicate: { all: [notDeleted, fieldIs('status', tracked)] } },
  },
  {
    from: { predicate: { all: [updating, fieldIs('status', missing)] }, permission: 'manage' },
    to: { predicate: { all: [notDeleted, fieldIs('status', missing)] } },
  },
  {
    from: {
      predicate: { all: [updating, notDeleted, fieldIs('status', untracked)] },
      permission: 'manage',
    },
    to: { predicate: { all: [notDeleted, fieldIs('status', untracked)] } },
  },
  {
    from: { predicate: { all: [updating, fieldIs('status', tracked)] }, permission: byAPerson },
    to: { predicate: { all: [notDeleted, fieldIs('status', untracked)] } },
  },
  {
    from: { predicate: { all: [updating, fieldIs('status', untracked)] }, permission: byAPerson },
    to: { predicate: { all: [notDeleted, fieldIs('status', tracked)] } },
  },
  {
    from: { predicate: { all: [updating, fieldIs('status', missing)] }, permission: byAPerson },
    to: { predicate: { all: [notDeleted, fieldIs('status', untracked)] } },
  },
  {
    from: {
      predicate: { all: [updating, fieldIs('status', tracked)] },
      permission: byItsIntegration,
    },
    to: { predicate: { all: [notDeleted, fieldIs('status', missing)] } },
  },
  {
    from: {
      predicate: { all: [updating, fieldIs('status', missing)] },
      permission: byItsIntegration,
    },
    to: { predicate: { all: [notDeleted, fieldIs('status', tracked)] } },
  },
];

export const integrationResourceTransitions: Record<string, Action> = {
  changeStatus: { paths: statusPaths },
  register: {
    paths: [
      {
        from: { predicate: creating, permission: 'create' },
        to: { predicate: fieldIs('status', tracked) },
      },
      ...statusPaths,
    ],
  },
};
