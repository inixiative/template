import { describe, expect, it } from 'bun:test';
import { ArrayOperator, Operator } from '@inixiative/json-rules';
import { app } from '#/app';
import { routeByOperationId } from '#/lib/routeTemplates/routeIndex';
import { flowDefinitions } from '#/modules/flow/definitions';
import { bindingsSchema } from '#/modules/flow/definitions/setUpOrganization/bindingsSchema';
import type { FlowDefinition, FlowStepDefinition } from '#/modules/flow/definitions/types';
import { flowDefinitionIssues } from '#/modules/flow/validations/flowDefinitionIssues';

const organization = { id: { bind: 'organizationId' } };

const definitionWith = (step: Partial<FlowStepDefinition>): Record<string, FlowDefinition> => ({
  setUpOrganization: {
    key: 'setUpOrganization',
    bindingsSchema,
    steps: [
      {
        key: 'probe',
        label: 'Probe',
        mode: 'navigate',
        to: '/users/members',
        search: { org: { bind: 'organizationId' } },
        completedWhen: {
          read: 'organizationSentManyInquiries',
          path: organization,
          rule: { field: 'status', operator: Operator.equals, value: 'sent' },
        },
        ...step,
      },
    ],
  },
});

const issuesFor = (step: Partial<FlowStepDefinition>) =>
  flowDefinitionIssues(definitionWith(step), routeByOperationId);

describe('flow definition validation', () => {
  it('passes every registered flow against the real route index', () => {
    expect(app).toBeDefined();
    expect(flowDefinitionIssues(flowDefinitions, routeByOperationId)).toEqual([]);
  });

  it('passes a well-formed read-many step', () => {
    expect(issuesFor({})).toEqual([]);
  });

  it('passes a single read whose response carries the relation the rule counts', () => {
    expect(
      issuesFor({
        completedWhen: {
          read: 'meRead',
          rule: {
            field: 'organizationUsers',
            arrayOperator: ArrayOperator.atLeast,
            count: 2,
            condition: { field: 'role', operator: Operator.in, value: ['member', 'admin'] },
          },
        },
      }),
    ).toEqual([]);
  });

  it('refuses a read that names no route', () => {
    expect(
      issuesFor({
        completedWhen: { read: 'organizationReadManyNothing', path: organization, rule: true },
      }),
    ).toEqual([
      'flow "setUpOrganization" probe: read "organizationReadManyNothing" is not a registered read route',
    ]);
  });

  it('refuses a list route that is not a paginated readMany with a filterLens', () => {
    const [issue] = issuesFor({ completedWhen: { read: 'authProviderReadMany', rule: true } });
    expect(issue).toContain('lists rows but is not a paginated readMany with a filterLens');
  });

  it('refuses a path that does not bind the route params', () => {
    const [issue] = issuesFor({
      completedWhen: { read: 'organizationSentManyInquiries', path: {}, rule: true },
    });
    expect(issue).toContain('path must bind exactly [id]');
  });

  it("refuses a rule reading outside the read's lens", () => {
    const [issue] = issuesFor({
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: organization,
        rule: { field: 'content', operator: Operator.equals, value: 'x' },
      },
    });
    expect(issue).toContain('rule reads outside the lens of "organizationSentManyInquiries"');
  });

  it("refuses a relation the single read's response does not carry", () => {
    const [issue] = issuesFor({
      completedWhen: {
        read: 'organizationRead',
        path: organization,
        rule: {
          field: 'organizationUsers',
          arrayOperator: ArrayOperator.atLeast,
          count: 2,
          condition: { field: 'role', operator: Operator.in, value: ['member', 'admin'] },
        },
      },
    });
    expect(issue).toContain('rule reads outside the lens of "organizationRead"');
  });

  it('refuses a bind the bindings schema does not cover, wherever it appears', () => {
    expect(
      issuesFor({
        search: { space: { bind: 'spaceId' } },
        completedWhen: {
          read: 'organizationSentManyInquiries',
          path: organization,
          rule: { field: 'targetUserId', operator: Operator.equals, bind: 'inviteeId' },
        },
      }),
    ).toEqual([
      'flow "setUpOrganization" probe: binds "inviteeId", which the flow\'s bindings schema does not cover',
      'flow "setUpOrganization" probe: binds "spaceId", which the flow\'s bindings schema does not cover',
    ]);
  });

  it('refuses an anchor step without a hash', () => {
    expect(issuesFor({ mode: 'anchor' })).toEqual([
      'flow "setUpOrganization" probe: an anchor step needs a hash',
    ]);
  });
});
