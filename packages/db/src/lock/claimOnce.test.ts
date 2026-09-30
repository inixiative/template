import { describe, expect, it } from 'bun:test';
import { createLock } from '@template/db/lock/createLock';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';

const newId = () => `claim-${crypto.randomUUID()}`;
const keyFor = (id: string) => `${redisNamespace.lock}:s:${id}`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const claim = (identifier: string, holder: string, ttlMs = 200) =>
  createLock({ service: 's', identifier, holder, ttlMs, heartbeat: false });

describe('createLock with heartbeat: false — one-shot claim', () => {
  it('the first claim succeeds and reports its own holder', async () => {
    const id = newId();
    expect(await claim(id, 'first').acquire()).toEqual({ claimed: true, holder: 'first' });
  });

  it('a second claim fails and names the incumbent', async () => {
    const id = newId();
    await claim(id, 'first').acquire();
    expect(await claim(id, 'second').acquire()).toEqual({ claimed: false, holder: 'first' });
  });

  it('refuses a replay from the original holder — a used value stays used', async () => {
    const id = newId();
    await claim(id, 'same').acquire();
    expect(await claim(id, 'same').acquire()).toEqual({ claimed: false, holder: 'same' });
  });

  it('never releases: there is no release handle at all', () => {
    expect('release' in claim(newId(), 'x')).toBe(false);
  });

  it('does not renew — the claim lapses on its ttl and the value is claimable again', async () => {
    const id = newId();
    await claim(id, 'first', 60).acquire();
    await sleep(140);
    expect(await getRedisClient().get(keyFor(id))).toBeNull();
    expect(await claim(id, 'later', 60).acquire()).toEqual({ claimed: true, holder: 'later' });
  });

  it('verify is true only for the holder that actually claimed it', async () => {
    const id = newId();
    const mine = claim(id, 'mine');
    await mine.acquire();
    expect(await mine.verify()).toBe(true);
    expect(await claim(id, 'theirs').verify()).toBe(false);
  });

  it('defaults a holder when the caller supplies none', async () => {
    const result = await createLock({
      service: 's',
      identifier: newId(),
      heartbeat: false,
      ttlMs: 200,
    }).acquire();
    expect(result.claimed).toBe(true);
    expect(result.holder).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('claims are atomic — exactly one of many concurrent claimants wins', async () => {
    const id = newId();
    const results = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((h) => claim(id, h).acquire()));
    const winners = results.filter((r) => r.claimed);
    expect(winners).toHaveLength(1);
    for (const loser of results.filter((r) => !r.claimed))
      expect(loser.holder).toBe(winners[0]?.holder ?? '');
  });
});

describe('createLock default behaviour is unchanged', () => {
  it('still renews and still releases', async () => {
    const lock = createLock({ service: 's', identifier: newId(), ttlMs: 300, heartbeatMs: 60 });
    expect(await lock.acquire()).toBe(true);
    await sleep(200);
    expect(await lock.verify()).toBe(true);
    expect(await lock.release()).toBe('released');
  });
});
