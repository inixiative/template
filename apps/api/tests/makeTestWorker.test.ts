import { describe, expect, it, spyOn } from 'bun:test';
import { type AuditActor, auditActorContext } from '@template/db/lib/auditActorContext';
import { jobHandlers } from '#/jobs/handlers';
import { makeTestWorker } from '#tests/makeTestWorker';

describe('makeTestWorker', () => {
  it('runs the handler as the same job actor processJob builds', async () => {
    const actors: (AuditActor | null)[] = [];
    const handlerSpy = spyOn(jobHandlers, 'sendWebhook').mockImplementation(async () => {
      actors.push(auditActorContext.currentActor());
    });

    try {
      const worker = makeTestWorker({ name: 'sendWebhook' });
      await worker.run({ integrationId: 'integration-1' });
      await worker.run({ subscriptionId: 'sub-1' });
    } finally {
      handlerSpy.mockRestore();
    }

    expect(actors.map((actor) => actor?.actorJobName)).toEqual(['sendWebhook', 'sendWebhook']);
    expect(actors.map((actor) => actor?.integrationId)).toEqual(['integration-1', null]);
  });
});
