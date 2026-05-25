import { describe, expect, it } from 'bun:test';
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { mergeNarrowingWheres } from '#/middleware/resources/mergeNarrowingWheres';

const baseNarrowing = (): LensNarrowing => ({
  parent: lensFor('Inquiry'),
  root: { picks: ['type', 'status'] },
});

const ruleA: Condition = { field: 'a', operator: 'equals', value: 1 };
const ruleB: Condition = { field: 'b', operator: 'equals', value: 2 };
const ruleC: Condition = { field: 'c', operator: 'equals', value: 3 };

describe('mergeNarrowingWheres', () => {
  describe('empty scope', () => {
    it('returns narrowing unchanged when scope is empty', () => {
      const before = baseNarrowing();
      const after = mergeNarrowingWheres(before, {});
      expect(after.root?.where).toBeUndefined();
      expect(after).toEqual(before);
    });
  });

  describe('root.where', () => {
    it('sets root.where when narrowing.root has none', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), { root: { where: ruleA } });
      expect(after.root?.where).toEqual(ruleA);
    });

    it('AND-merges when both narrowing.root and scope have a where', () => {
      const initial = baseNarrowing();
      initial.root!.where = ruleA;
      const after = mergeNarrowingWheres(initial, { root: { where: ruleB } });
      expect(after.root?.where).toEqual({ all: [ruleA, ruleB] });
    });

    it('preserves picks on root when adding where', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), { root: { where: ruleA } });
      expect(after.root?.picks).toEqual(['type', 'status']);
    });
  });

  describe('root.relations[R].where (descent scoping)', () => {
    it('adds relation entry with where when none existed', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), {
        root: { relations: { sourceUser: { where: ruleA } } },
      });
      expect(after.root?.relations?.sourceUser.where).toEqual(ruleA);
    });

    it('AND-merges relation where when one already exists', () => {
      const initial = baseNarrowing();
      initial.root!.relations = { sourceUser: { where: ruleA } };
      const after = mergeNarrowingWheres(initial, { root: { relations: { sourceUser: { where: ruleB } } } });
      expect(after.root?.relations?.sourceUser.where).toEqual({ all: [ruleA, ruleB] });
    });

    it('preserves existing picks on the relation when adding where', () => {
      const initial = baseNarrowing();
      initial.root!.relations = { sourceUser: { picks: ['id', 'name'] } };
      const after = mergeNarrowingWheres(initial, { root: { relations: { sourceUser: { where: ruleA } } } });
      expect(after.root?.relations?.sourceUser).toEqual({ picks: ['id', 'name'], where: ruleA });
    });

    it('recurses on deeper relation paths', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), {
        root: {
          relations: {
            sourceUser: {
              where: ruleA,
              relations: { account: { where: ruleB } },
            },
          },
        },
      });
      expect(after.root?.relations?.sourceUser.where).toEqual(ruleA);
      expect(after.root?.relations?.sourceUser.relations?.account.where).toEqual(ruleB);
    });
  });

  describe('mapDefaults.<map>.models[X].where (everywhere-X scoping)', () => {
    it('adds mapDefaults entry when none existed', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), {
        mapDefaults: { prisma: { models: { User: { where: ruleA } } } },
      });
      expect(after.mapDefaults?.prisma?.models?.User.where).toEqual(ruleA);
    });

    it('AND-merges when one already exists', () => {
      const initial = baseNarrowing();
      initial.mapDefaults = { prisma: { models: { User: { where: ruleA } } } };
      const after = mergeNarrowingWheres(initial, {
        mapDefaults: { prisma: { models: { User: { where: ruleB } } } },
      });
      expect(after.mapDefaults?.prisma?.models?.User.where).toEqual({ all: [ruleA, ruleB] });
    });

    it('preserves picks/enumPicks on existing mapDefaults model when adding where', () => {
      const initial = baseNarrowing();
      initial.mapDefaults = {
        prisma: { models: { User: { picks: ['id', 'name'], enumPicks: { PlatformRole: ['user'] } } } },
      };
      const after = mergeNarrowingWheres(initial, {
        mapDefaults: { prisma: { models: { User: { where: ruleA } } } },
      });
      expect(after.mapDefaults?.prisma?.models?.User).toEqual({
        picks: ['id', 'name'],
        enumPicks: { PlatformRole: ['user'] },
        where: ruleA,
      });
    });
  });

  describe('cross-slot composition', () => {
    it('applies root and mapDefaults in one merge', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), {
        root: { where: ruleA, relations: { sourceUser: { where: ruleB } } },
        mapDefaults: { prisma: { models: { User: { where: ruleC } } } },
      });
      expect(after.root?.where).toEqual(ruleA);
      expect(after.root?.relations?.sourceUser.where).toEqual(ruleB);
      expect(after.mapDefaults?.prisma?.models?.User.where).toEqual(ruleC);
    });
  });

  describe('immutability', () => {
    it('does not mutate the input narrowing', () => {
      const initial = baseNarrowing();
      initial.root!.where = ruleA;
      initial.root!.relations = { sourceUser: { where: ruleA } };
      initial.mapDefaults = { prisma: { models: { User: { where: ruleA } } } };
      const snapshot = structuredClone(initial);
      mergeNarrowingWheres(initial, {
        root: { where: ruleB, relations: { sourceUser: { where: ruleB } } },
        mapDefaults: { prisma: { models: { User: { where: ruleB } } } },
      });
      expect(initial).toEqual(snapshot);
    });
  });
});
