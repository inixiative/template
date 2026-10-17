import { afterAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db/generated/client/client';
import type { FlowKey } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import type { z } from 'zod';
import { flowRouter } from '#/modules/flow';
import { flowRegistry } from '#/modules/flow/registry/flowRegistry';
import type { flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

type FlowResponse = z.infer<typeof flowResponseSchema>;
type Harness = ReturnType<typeof createTestApp>;

const mount = [
  (app: Harness['app']) => app.route('/api/v1/me', meRouter),
  (app: Harness['app']) => app.route('/api/v1/flow', flowRouter),
  (app: Harness['app']) => app.route('/api/v1/organization', organizationRouter),
];

const callerFor: Record<
  FlowKey,
  () => Promise<{ app: Harness; bindings: Record<string, unknown> }>
> = {
  setUpOrganization: async () => {
    const { entity: user } = await createUser();
    const { entity: organization } = await createOrganization();
    const { entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user, organization },
    );
    return {
      app: createTestApp({ mockUser: user as User, mockOrganizationUsers: [seat], mount }),
      bindings: { organizationId: organization.id },
    };
  },
};

describe('flow registry', () => {
  let db: Harness['db'] | undefined;

  afterAll(async () => {
    if (db) await cleanupTouchedTables(db);
  });

  for (const definition of Object.values(flowRegistry)) {
    it(`${definition.key}: every step reads a real route that answers 200`, async () => {
      const { app, bindings } = await callerFor[definition.key]();
      db = app.db;
      const response = await app.fetch(
        post('/api/v1/me/flows', { flowKey: definition.key, bindings }),
      );
      expect(response.status).toBe(201);

      const { steps } = (await json<FlowResponse>(response)).data;
      for (const step of steps) {
        const read = await app.fetch(get(step.readPath));
        expect({ step: step.key, status: read.status }).toEqual({ step: step.key, status: 200 });
      }
    });
  }
});
