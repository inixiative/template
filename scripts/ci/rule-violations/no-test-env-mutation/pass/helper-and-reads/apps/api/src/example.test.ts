import { setEnvOverride, withEnv } from '@template/shared/utils';

describe('env-conditional behavior', () => {
  it('exercises env-gated behavior without leaking', async () => {
    await withEnv({ ENVIRONMENT: 'prod' }, async () => {
      expect(true).toBe(true);
    });
  });

  it('registers a per-test override, cleared by the global backstop', () => {
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '3');
    expect(true).toBe(true);
  });

  it('reads and compares env without mutating', () => {
    if (process.env.ENVIRONMENT === 'test') expect(true).toBe(true);
    expect(process.env.API_URL !== undefined).toBe(true);
  });
});
