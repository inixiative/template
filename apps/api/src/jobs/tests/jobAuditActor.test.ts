import { describe, expect, it } from 'bun:test';
import { nullAuditActor } from '@template/db/lib/auditActorContext';
import { jobAuditActor } from '#/jobs/jobAuditActor';

describe('jobAuditActor', () => {
  it('names the job and the integration the payload acts for', () => {
    expect(jobAuditActor('syncCrm', { integrationId: 'integration-1' })).toEqual({
      ...nullAuditActor,
      actorJobName: 'syncCrm',
      integrationId: 'integration-1',
    });
  });

  it.each([
    ['no payload', undefined],
    ['a null payload', null],
    ['a non-object payload', 'integration-1'],
    ['a payload without integrationId', { id: 'x' }],
    ['a non-string integrationId', { integrationId: 42 }],
  ])('leaves integrationId null for %s', (_case, payload) => {
    expect(jobAuditActor('syncCrm', payload)).toEqual({
      ...nullAuditActor,
      actorJobName: 'syncCrm',
    });
  });
});
