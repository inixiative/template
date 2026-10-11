import { describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { app } from '#/app';
import { routeByOperationId } from '#/lib/routeTemplates/routeIndex';
import { flowDefinitions } from '#/modules/flow/definitions';
import { paramsSchema } from '#/modules/flow/definitions/setUpOrganization/schema';
import type { FlowDefinition, FlowStepDefinition } from '#/modules/flow/definitions/types';
import { flowDefinitionIssues } from '#/modules/flow/validations/flowDefinitionIssues';

const definitionWith = (step: Partial<FlowStepDefinition>): Record<string, FlowDefinition> => ({
  setUpOrganization: {
    key: 'setUpOrganization',
    paramsSchema,
    steps: [
      {
        key: 'probe',
        label: 'Probe',
        url: '/users/members?org={{organizationId}}',
        mode: 'navigate',
        completedWhen: {
          read: 'organizationSentManyInquiries',
          path: { id: '{{organizationId}}' },
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

  it('passes a well-formed step', () => {
    expect(issuesFor({})).toEqual([]);
  });

  it('refuses a read that names no route', () => {
    expect(
      issuesFor({ completedWhen: { read: 'organizationReadManyNothing', path: { id: 'x' } } }),
    ).toEqual([
      'flow "setUpOrganization" probe: read "organizationReadManyNothing" is not a registered route',
    ]);
  });

  it('refuses a read that is not a paginated readMany with a filterLens', () => {
    const [issue] = issuesFor({
      completedWhen: { read: 'organizationRead', path: { id: '{{organizationId}}' } },
    });
    expect(issue).toContain('is not a paginated readMany route with a filterLens');
  });

  it('refuses a path that does not fill the route params', () => {
    const [issue] = issuesFor({
      completedWhen: { read: 'organizationSentManyInquiries', path: {} },
    });
    expect(issue).toContain('path must fill exactly [id]');
  });

  it('refuses a template naming a param the flow does not have', () => {
    const issues = issuesFor({ url: '/x?space={{spaceId}}' });
    expect(issues).toEqual([
      'flow "setUpOrganization" probe: {{spaceId}} is not a param of this flow',
    ]);
  });

  it('refuses a where reading a field outside the route filterLens', () => {
    const [issue] = issuesFor({
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: { id: '{{organizationId}}' },
        where: { field: 'content', operator: Operator.equals, value: 'x' },
      },
    });
    expect(issue).toContain(
      'where reads outside the filterLens of "organizationSentManyInquiries"',
    );
  });

  it('refuses a where binding a name that is not a flow param', () => {
    const [issue] = issuesFor({
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: { id: '{{organizationId}}' },
        where: { field: 'targetUserId', operator: Operator.equals, bind: 'someoneElse' },
      },
    });
    expect(issue).toContain('where binds "someoneElse"');
  });

  it('refuses a non-positive count', () => {
    const [issue] = issuesFor({
      completedWhen: {
        read: 'organizationSentManyInquiries',
        path: { id: '{{organizationId}}' },
        count: { atLeast: 0 },
      },
    });
    expect(issue).toContain('count.atLeast must be a positive integer');
  });
});
