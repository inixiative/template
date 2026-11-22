/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz, feature:integrations
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import type { Action, Transition } from '@inixiative/transitions';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import {
  actingAsAPerson,
  actingAsTheRecordsIntegration,
} from '@template/permissions/rebac/rebacSchemaRules';
import type { ActionRule } from '@template/permissions/rebac/types';

const { tracked, missing, untracked } = IntegrationResourceStatus;

const statusIs = (status: IntegrationResourceStatus): Condition => ({
  field: 'status',
  operator: Operator.equals,
  value: status,
});
const registered: Condition = { field: 'id', operator: Operator.exists };
const unregistered: Condition = { field: 'id', operator: Operator.notExists };
const live: Condition = { field: 'deletedAt', operator: Operator.notExists };
const removed: Condition = { field: 'deletedAt', operator: Operator.exists };

const byAPerson: ActionRule = { all: ['manage', actingAsAPerson] };
const byItsIntegration: ActionRule = { all: ['manage', actingAsTheRecordsIntegration] };

type StatusMove = {
  from: IntegrationResourceStatus;
  to: IntegrationResourceStatus;
  permission: ActionRule;
};

const statusMoves: StatusMove[] = [
  { from: tracked, to: tracked, permission: 'manage' },
  { from: missing, to: missing, permission: 'manage' },
  { from: untracked, to: untracked, permission: 'manage' },
  { from: tracked, to: untracked, permission: byAPerson },
  { from: untracked, to: tracked, permission: byAPerson },
  { from: missing, to: untracked, permission: byAPerson },
  { from: tracked, to: missing, permission: byItsIntegration },
  { from: missing, to: tracked, permission: byItsIntegration },
];

const moveFrom = (move: StatusMove, rowState: Condition): Transition => ({
  from: { predicate: { all: [rowState, statusIs(move.from)] }, permission: move.permission },
  to: { predicate: { all: [live, statusIs(move.to)] } },
});

const staysRemovedUnlessTracked = (move: StatusMove) =>
  !(move.from === untracked && move.to === untracked);

export const integrationResourceTransitions: Record<string, Action> = {
  changeStatus: { paths: statusMoves.map((move) => moveFrom(move, registered)) },
  register: {
    paths: [
      {
        from: { predicate: unregistered, permission: 'create' },
        to: { predicate: statusIs(tracked) },
      },
      ...statusMoves.map((move) => moveFrom(move, { all: [registered, live] })),
      ...statusMoves
        .filter(staysRemovedUnlessTracked)
        .map((move) => moveFrom(move, { all: [registered, removed] })),
    ],
  },
};
