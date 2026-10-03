import { afterEach, describe, expect, it } from 'bun:test';
import {
  type AuditActor,
  auditActorContext,
  nullAuditActor,
} from '@template/db/lib/auditActorContext';
import { enqueueJob } from '#/jobs/enqueue';
import { jobHandlers } from '#/jobs/handlers';

const registry = jobHandlers as unknown as Record<string, unknown>;
const original = registry.sweepSegments;

describe('enqueueJob in test', () => {
  afterEach(() => {
    registry.sweepSegments = original;
  });

  it('runs the handler as the job actor, not the request that enqueued it', async () => {
    const seen: (AuditActor | null)[] = [];
    registry.sweepSegments = async () => {
      seen.push(auditActorContext.getScope());
    };
    const requestActor = { ...nullAuditActor, actorUserId: 'request-user' };

    await auditActorContext.scope(requestActor, async () => {
      await enqueueJob('sweepSegments', undefined);
      seen.push(auditActorContext.getScope());
    });

    expect(seen[0]?.actorJobName).toBe('sweepSegments');
    expect(seen[0]?.actorUserId).toBeNull();
    expect(seen[1]).toEqual(requestActor);
  });
});
