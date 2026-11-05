// PROBE — not for merge. Measures cache() traffic and SQL statements inside transactionAll batches,
// with #224's overlay vs Alexandre's one-liner (PROBE_CACHE_TXN_BYPASS=1). See tmp/cache-txn-workload-plan.md.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { db, getRedisClient, unregisterDbHook } from '@template/db';
import {
  cleanupTouchedTables,
  createContact,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { batchRouter } from '#/modules/batch';
import { contactRouter } from '#/modules/contact';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';

const ROOT = join(import.meta.dirname, '../../../../../..');
const pg = require(Bun.resolveSync('pg', join(ROOT, 'packages/db')));
const otel = require(Bun.resolveSync('@opentelemetry/api', join(ROOT, 'packages/shared')));

type Tally = Map<string, number>;
const sql = { count: 0, selects: 0, byTable: new Map() as Tally };
const cacheReads = { inTxn: new Map() as Tally, outTxn: new Map() as Tally };
let recording = false;

const bump = (tally: Tally, key: string) => tally.set(key, (tally.get(key) ?? 0) + 1);

const originalQuery = pg.Client.prototype.query;
pg.Client.prototype.query = function (this: unknown, ...args: unknown[]) {
  if (recording) {
    const first = args[0] as string | { text?: string };
    const text = typeof first === 'string' ? first : (first?.text ?? '');
    sql.count++;
    if (/^\s*SELECT/i.test(text)) {
      sql.selects++;
      bump(sql.byTable, text.match(/FROM\s+"public"\."(\w+)"/i)?.[1] ?? 'other');
    }
  }
  return originalQuery.apply(this, args);
};

const prismaOps = { count: 0, byModel: new Map() as Tally };
const noopMeter = otel.createNoopMeter();
const probeMeter = Object.assign(Object.create(noopMeter), {
  createHistogram: (name: string) => ({
    record: (_value: number, attributes: Record<string, string>) => {
      if (!recording || name !== 'db.client.operation.duration') return;
      prismaOps.count++;
      bump(
        prismaOps.byModel,
        `${attributes['db.collection.name']}.${attributes['db.operation.name']}`,
      );
    },
  }),
  createCounter: (name: string) => ({
    add: (_value: number, attributes: { accessor?: string; result?: string }) => {
      if (!recording || name !== 'cache.read') return;
      bump(
        db.isInTxn() ? cacheReads.inTxn : cacheReads.outTxn,
        `${attributes.accessor}:${attributes.result}`,
      );
    },
  }),
});
otel.metrics.setGlobalMeterProvider({ getMeter: () => probeMeter });

const SPACES = 5;
const CONTACTS_PER_SPACE = 100;

const { call } = createTokenProbeApp((hono) => {
  hono.route('/api/v1/batch', batchRouter);
  hono.route('/api/v1/contact', contactRouter);
});

type Workload = { name: string; rounds: number; perRound: number; writeShare: number };
type Mode = 'overlay' | 'bypass';
type Redis = 'cold' | 'warm';
type Owner = 'OrganizationUser' | 'User';
const REPS = 3;

const WORKLOADS: Workload[] = [
  { name: 'read 1x10', rounds: 1, perRound: 10, writeShare: 0 },
  { name: 'read 2x50', rounds: 2, perRound: 50, writeShare: 0 },
  { name: 'read 10x10', rounds: 10, perRound: 10, writeShare: 0 },
  { name: 'mixed 2x50', rounds: 2, perRound: 50, writeShare: 0.5 },
  { name: 'mixed 10x10', rounds: 10, perRound: 10, writeShare: 0.5 },
];

describe('PROBE: cache() inside transactionAll under load', () => {
  const rawKeys: Record<Owner, string> = { OrganizationUser: '', User: '' };
  let contactIds: string[];
  const rows: Record<string, unknown>[] = [];

  beforeAll(async () => {
    registerClearCacheHook();
    const owner = await createOrganizationUser({ role: 'owner' });
    const organization = owner.context.organization;
    const spaces = await Promise.all(
      Array.from({ length: SPACES }, () => createSpace({}, { organization })),
    );
    const bySpace: string[][] = [];
    for (const space of spaces) {
      const created = await Promise.all(
        Array.from({ length: CONTACTS_PER_SPACE }, () =>
          createContact({ ownerModel: 'Space', spaceId: space.entity.id }, { space: space.entity }),
        ),
      );
      bySpace.push(created.map((contact) => contact.entity.id));
    }
    contactIds = Array.from({ length: CONTACTS_PER_SPACE }, (_, index) =>
      bySpace.map((ids) => ids[index]),
    ).flat();
    rawKeys.OrganizationUser = (
      await createKeyedToken(
        { ownerModel: 'OrganizationUser', role: 'owner' },
        { organizationUser: owner.entity },
      )
    ).rawKey;
    const user = owner.context.user;
    await Promise.all(
      spaces.map((space) =>
        createSpaceUser(
          { role: 'owner' },
          { organizationUser: owner.entity, space: space.entity, organization, user },
        ),
      ),
    );
    rawKeys.User = (await createKeyedToken({ ownerModel: 'User', role: 'owner' }, { user })).rawKey;
  });

  afterAll(async () => {
    pg.Client.prototype.query = originalQuery;
    delete process.env.PROBE_CACHE_TXN_BYPASS;
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
    console.table(rows);
  });

  const rounds = (workload: Workload) => {
    let cursor = 0;
    return Array.from({ length: workload.rounds }, () =>
      Array.from({ length: workload.perRound }, (_, index) => {
        const id = contactIds[cursor++ % contactIds.length];
        const isWrite = index < workload.perRound * workload.writeShare;
        return isWrite
          ? {
              method: 'PATCH',
              path: `/api/v1/contact/${id}`,
              body: { acceptedKinds: ['platform'] },
            }
          : { method: 'GET', path: `/api/v1/contact/${id}` };
      }),
    );
  };

  const run = async (workload: Workload, mode: Mode, redis: Redis, ownerModel: Owner) => {
    const rawKey = rawKeys[ownerModel];
    const times: number[] = [];
    for (let rep = 0; rep < REPS; rep++) {
      if (mode === 'bypass') process.env.PROBE_CACHE_TXN_BYPASS = '1';
      else delete process.env.PROBE_CACHE_TXN_BYPASS;
      await getRedisClient().flushall();
      if (redis === 'warm') {
        await call(rawKey, 'POST', '/api/v1/batch/execute', {
          requests: rounds(workload),
          strategy: 'allowFailures',
        });
      }

      sql.count = 0;
      sql.selects = 0;
      sql.byTable.clear();
      prismaOps.count = 0;
      prismaOps.byModel.clear();
      cacheReads.inTxn.clear();
      cacheReads.outTxn.clear();
      recording = true;
      const started = performance.now();
      const response = await call(rawKey, 'POST', '/api/v1/batch/execute', {
        requests: rounds(workload),
        strategy: 'transactionAll',
      });
      times.push(performance.now() - started);
      recording = false;
      if (rep < REPS - 1) {
        await response.text();
        continue;
      }
      const ms = Math.round(times.sort((a, b) => a - b)[1]);

      const body = (await response.json()) as {
        data: { summary: { status: string; failedRequests: number } };
      };
      if (!body.data)
        console.log('BATCH FAILED', response.status, JSON.stringify(body).slice(0, 600));
      expect(body.data.summary.status).toBe('success');

      const inTxn = [...cacheReads.inTxn.entries()];
      const total = (result: string) =>
        inTxn.filter(([key]) => key.endsWith(`:${result}`)).reduce((sum, [, n]) => sum + n, 0);
      rows.push({
        owner: ownerModel,
        workload: workload.name,
        mode,
        redis,
        ms,
        prismaOps: prismaOps.count,
        sqlStatements: sql.count,
        sqlSelects: sql.selects,
        txnCacheCalls: inTxn.reduce((sum, [, n]) => sum + n, 0),
        overlayHit: total('overlay'),
        redisHit: total('hit'),
        computed: total('miss') + total('bypass'),
      });
      console.log(
        `\n[${workload.name} | ${mode} | ${redis}] in-txn cache():`,
        Object.fromEntries([...cacheReads.inTxn.entries()].sort()),
        '\n  prisma ops:',
        Object.fromEntries([...prismaOps.byModel.entries()].sort((a, b) => b[1] - a[1])),
        '\n  selects by table:',
        Object.fromEntries([...sql.byTable.entries()].sort((a, b) => b[1] - a[1])),
      );
    }
  };

  for (const ownerModel of ['OrganizationUser', 'User'] as const) {
    for (const workload of WORKLOADS) {
      for (const redis of ['cold', 'warm'] as const) {
        for (const mode of ['bypass', 'overlay'] as const) {
          it(
            `${ownerModel} ${workload.name} ${mode} ${redis}`,
            () => run(workload, mode, redis, ownerModel),
            120_000,
          );
        }
      }
    }
  }
});
