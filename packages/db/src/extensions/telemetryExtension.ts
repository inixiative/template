/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import { recordDuration, SpanKind, withSpan } from '@template/shared/telemetry';

export const telemetryExtension = Prisma.defineExtension({
  name: 'telemetry',
  query: {
    async $allOperations({ model, operation, args, query }) {
      const attributes = {
        'db.system.name': 'postgresql',
        'db.operation.name': operation,
        'db.collection.name': model ?? 'raw',
      };
      return withSpan(`${model ?? 'db'}.${operation}`, { kind: SpanKind.CLIENT, attributes }, async () => {
        const start = performance.now();
        let outcome = 'success';
        try {
          return await query(args);
        } catch (error) {
          outcome = 'error';
          throw error;
        } finally {
          recordDuration('db.client.operation.duration', (performance.now() - start) / 1000, {
            ...attributes,
            outcome,
          });
        }
      });
    },
  },
});
