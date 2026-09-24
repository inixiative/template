import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureCicd, updateCicdSettings } from '../../init/tasks/cicdSettings';
import { databaseReleaseCommands } from '../db/release';
import { evaluateApprovals, type PullRequestReview } from './approvals';
import { type CicdConfig, cicdSchema, loadCicdConfig, saveCicdConfig } from './config';
import { makeCicdConfig } from './fixtures';
import { planDelivery } from './plan';

const fresh = (): CicdConfig => makeCicdConfig();

describe('delivery policy', () => {
  for (const pr of ['auto', 'manual'] as const) {
    for (const drafts of ['auto', 'manual'] as const) {
      test(`PR ${pr}, draft ${drafts}: draft policy overrides ordinary PR policy`, () => {
        const config = updateCicdSettings(fresh(), [`--pr=${pr}`, `--drafts=${drafts}`]);
        for (const draft of [true, false]) {
          const plan = planDelivery(config, {
            kind: 'pull-request',
            number: 12,
            draft,
            sameRepository: true,
            closed: false,
          });
          expect(plan.action).toBe((draft ? drafts : pr) === 'auto' ? 'deploy' : 'skip');
          expect(plan.prechecks).toBe(plan.action === 'deploy');
          expect(plan.postchecks).toBe(plan.action === 'deploy');
        }
      });
    }
  }
  test('main always deploys; staging follows its enablement; other pushes never create previews', () => {
    const config = fresh();
    expect(planDelivery(config, { kind: 'push', branch: 'main' }).action).toBe('deploy');
    expect(planDelivery(config, { kind: 'push', branch: 'staging' }).action).toBe('skip');
    expect(planDelivery(config, { kind: 'deploy', target: 'staging' }).action).toBe('skip');
    config.staging.enabled = true;
    expect(planDelivery(config, { kind: 'push', branch: 'staging' }).action).toBe('deploy');
    expect(planDelivery(config, { kind: 'push', branch: 'feature/change' }).action).toBe('skip');
  });
  test('manual previews bypass auto selection, never fork or closed-PR restrictions', () => {
    const config = fresh();
    expect(
      planDelivery(config, { kind: 'deploy-preview', number: 12, sameRepository: true, closed: false }).action,
    ).toBe('deploy');
    expect(
      planDelivery(config, { kind: 'deploy-preview', number: 12, sameRepository: false, closed: false }).action,
    ).toBe('skip');
    expect(
      planDelivery(config, { kind: 'deploy-preview', number: 12, sameRepository: true, closed: true }).action,
    ).toBe('skip');
  });
  test('close/merge always plans cleanup, including manual drafts and formerly untrusted PRs', () => {
    expect(
      planDelivery(fresh(), { kind: 'pull-request', number: 12, draft: true, sameRepository: false, closed: true })
        .action,
    ).toBe('teardown');
    expect(planDelivery(fresh(), { kind: 'teardown', number: 12 }).target).toBe('pr-12');
    expect(() => planDelivery(fresh(), { kind: 'teardown', number: -1 })).toThrow();
  });
  test('unknown settings, fractional approval counts and shared branches fail closed', () => {
    expect(() => cicdSchema.parse({ ...fresh(), secrets: {} })).toThrow();
    expect(() => cicdSchema.parse({ ...fresh(), checks: { pre: false, post: true } })).toThrow();
    expect(() => updateCicdSettings(fresh(), ['--approvals=1.5'])).toThrow();
    expect(() => updateCicdSettings(fresh(), ['--pr=auto', '--pr=manual'])).toThrow();
    expect(() => updateCicdSettings(fresh(), ['--unknown=true'])).toThrow();
    expect(() => updateCicdSettings(fresh(), ['--staging-branch=main'])).toThrow();
    expect(updateCicdSettings(fresh(), ['--approvals=100']).pullRequests.requiredApprovals).toBe(100);
  });
  test('headless settings persist independently without stale reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'template-cicd-'));
    try {
      await saveCicdConfig(fresh(), root);
      await configureCicd(['--section=cicd', '--approvals=3', '--bot-approvals=on', '--staging=on'], root);
      expect((await loadCicdConfig(root)).pullRequests.requiredApprovals).toBe(3);
      await configureCicd(['--approvals=0', '--pr=auto'], root);
      const value = await loadCicdConfig(root);
      expect(value.pullRequests.requiredApprovals).toBe(0);
      expect(value.pullRequests.allowBotApprovals).toBe(true);
      expect(value.staging.enabled).toBe(true);
      expect(value.pullRequests.deploy).toBe('auto');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('merge approvals', () => {
  const review = (id: number, authorId: number, overrides: Partial<PullRequestReview> = {}): PullRequestReview => ({
    id,
    authorId,
    authorType: 'User',
    state: 'APPROVED',
    commitId: 'head',
    canApprove: true,
    ...overrides,
  });
  test('counts distinct eligible reviewers; rejects stale, self and unauthorized approvals', () => {
    const policy = { ...fresh().pullRequests, requiredApprovals: 2 };
    const reviews = [
      review(1, 1),
      review(2, 2),
      review(3, 2),
      review(4, 3, { commitId: 'old' }),
      review(5, 4, { canApprove: false }),
    ];
    expect(evaluateApprovals(policy, 'head', 1, reviews)).toMatchObject({ approved: false, count: 1 });
    expect(evaluateApprovals(policy, 'head', 1, [...reviews, review(6, 5)])).toMatchObject({
      approved: true,
      count: 2,
    });
  });
  test('bot approvals count only when configured; zero approvals remains valid', () => {
    const policy = fresh().pullRequests;
    const reviews = [review(1, 2, { authorType: 'Bot' })];
    expect(evaluateApprovals(policy, 'head', 1, reviews).approved).toBe(false);
    expect(evaluateApprovals({ ...policy, allowBotApprovals: true }, 'head', 1, reviews).approved).toBe(true);
    expect(evaluateApprovals({ ...policy, requiredApprovals: 0 }, 'head', 1, []).approved).toBe(true);
  });
  test('dismissal and change requests revoke approval; comments do not; arrival order is irrelevant', () => {
    const policy = fresh().pullRequests;
    expect(evaluateApprovals(policy, 'head', 1, [review(3, 2, { state: 'DISMISSED' }), review(1, 2)]).approved).toBe(
      false,
    );
    expect(evaluateApprovals(policy, 'head', 1, [review(1, 2), review(2, 2, { state: 'COMMENTED' })]).approved).toBe(
      true,
    );
    expect(
      evaluateApprovals(policy, 'head', 1, [
        review(1, 2),
        review(2, 3, { state: 'CHANGES_REQUESTED', commitId: 'old' }),
      ]).approved,
    ).toBe(false);
  });
});

describe('database release policy', () => {
  test('pre-migration releases use schema push without accepting data loss', () => {
    const commands = databaseReleaseCommands('schema-push', [], true);
    expect(commands[0].slice(-2)).toEqual(['db', 'push']);
    expect(commands.flat()).not.toContain('--accept-data-loss');
  });
  test('releases seed system data under both strategies', () => {
    expect(databaseReleaseCommands('schema-push', [], true)[1]?.slice(-1)).toEqual(['db:seed']);
    expect(databaseReleaseCommands('migrations', ['0_init/migration.sql'], true)[1]?.slice(-1)).toEqual(['db:seed']);
  });
  test('seeding can be turned off explicitly', () => {
    expect(databaseReleaseCommands('schema-push', [], false).flat()).not.toContain('db:seed');
    expect(databaseReleaseCommands('migrations', ['0_init/migration.sql'], false).flat()).not.toContain('db:seed');
  });
  test('migration mode requires a baseline and schema push cannot bypass existing migrations', () => {
    expect(() => databaseReleaseCommands('migrations', [], true)).toThrow('baseline');
    expect(() => databaseReleaseCommands('schema-push', ['0_init/migration.sql'], true)).toThrow('Select migrations');
    expect(databaseReleaseCommands('migrations', ['0_init/migration.sql'], true)[0].slice(-2)).toEqual([
      'migrate',
      'deploy',
    ]);
  });
});
