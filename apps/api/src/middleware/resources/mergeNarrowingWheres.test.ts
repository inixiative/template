import { describe, expect, it } from 'bun:test';
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { mergeNarrowingWheres } from '#/middleware/resources/mergeNarrowingWheres';

const baseNarrowing = (): LensNarrowing => ({
  parent: lensFor('Inquiry'),
  maps: { prisma: { models: { Inquiry: { picks: ['type', 'status'] } } } },
});

const ruleA: Condition = { field: 'a', operator: 'equals', value: 1 };
const ruleB: Condition = { field: 'b', operator: 'equals', value: 2 };
const ruleC: Condition = { field: 'c', operator: 'equals', value: 3 };

describe('mergeNarrowingWheres', () => {
  describe('empty scope', () => {
    it('returns narrowing unchanged when scope is empty', () => {
      const before = baseNarrowing();
      const after = mergeNarrowingWheres(before, {});
      expect(after.where).toBeUndefined();
      expect(after.maps).toEqual(before.maps);
    });
  });

  describe('root where', () => {
    it('sets root where when narrowing has none', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), { where: ruleA });
      expect(after.where).toEqual(ruleA);
    });

    it('AND-merges when both narrowing and scope have a root where', () => {
      const initial = baseNarrowing();
      initial.where = ruleA;
      const after = mergeNarrowingWheres(initial, { where: ruleB });
      expect(after.where).toEqual({ all: [ruleA, ruleB] });
    });
  });

  describe('relations where (descent scoping under root model)', () => {
    it('adds relation entry with where when none existed', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), { relations: { sourceUser: ruleA } });
      expect(after.maps.default.models.Inquiry.relations?.sourceUser.where).toEqual(ruleA);
    });

    it('AND-merges relation where when one already exists', () => {
      const initial = baseNarrowing();
      initial.maps.default.models.Inquiry.relations = { sourceUser: { where: ruleA } };
      const after = mergeNarrowingWheres(initial, { relations: { sourceUser: ruleB } });
      expect(after.maps.default.models.Inquiry.relations?.sourceUser.where).toEqual({ all: [ruleA, ruleB] });
    });

    it('preserves existing picks/omits on the relation when adding where', () => {
      const initial = baseNarrowing();
      initial.maps.default.models.Inquiry.relations = { sourceUser: { picks: ['id', 'name'] } };
      const after = mergeNarrowingWheres(initial, { relations: { sourceUser: ruleA } });
      expect(after.maps.default.models.Inquiry.relations?.sourceUser).toEqual({
        picks: ['id', 'name'],
        where: ruleA,
      });
    });

    it('preserves picks/omits on the root model when adding relations', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), { relations: { sourceUser: ruleA } });
      expect(after.maps.default.models.Inquiry.picks).toEqual(['type', 'status']);
    });
  });

  describe('defaults where (everywhere-X scoping)', () => {
    it('adds defaults.models[X] with where when none existed', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), { defaults: { User: ruleA } });
      expect(after.maps.default.defaults?.models?.User.where).toEqual(ruleA);
    });

    it('AND-merges defaults.models[X].where when one already exists', () => {
      const initial = baseNarrowing();
      initial.maps.default.defaults = { models: { User: { where: ruleA } } };
      const after = mergeNarrowingWheres(initial, { defaults: { User: ruleB } });
      expect(after.maps.default.defaults?.models?.User.where).toEqual({ all: [ruleA, ruleB] });
    });

    it('preserves picks/enumPicks on defaults.models[X] when adding where', () => {
      const initial = baseNarrowing();
      initial.maps.default.defaults = {
        models: { User: { picks: ['id', 'name'], enumPicks: { PlatformRole: ['user'] } } },
      };
      const after = mergeNarrowingWheres(initial, { defaults: { User: ruleA } });
      expect(after.maps.default.defaults?.models?.User).toEqual({
        picks: ['id', 'name'],
        enumPicks: { PlatformRole: ['user'] },
        where: ruleA,
      });
    });
  });

  describe('cross-slot composition', () => {
    it('applies all three slots in one merge', () => {
      const after = mergeNarrowingWheres(baseNarrowing(), {
        where: ruleA,
        relations: { sourceUser: ruleB },
        defaults: { User: ruleC },
      });
      expect(after.where).toEqual(ruleA);
      expect(after.maps.default.models.Inquiry.relations?.sourceUser.where).toEqual(ruleB);
      expect(after.maps.default.defaults?.models?.User.where).toEqual(ruleC);
    });

    it('fans out across multiple maps (relations + defaults apply to every map)', () => {
      const initial: LensNarrowing = {
        parent: lensFor('Inquiry'),
        maps: {
          default: { models: { Inquiry: { picks: ['type'] } } },
          admin: { models: { Inquiry: { picks: ['type', 'status'] } } },
        },
      };
      const after = mergeNarrowingWheres(initial, {
        relations: { sourceUser: ruleA },
        defaults: { User: ruleB },
      });
      expect(after.maps.default.models.Inquiry.relations?.sourceUser.where).toEqual(ruleA);
      expect(after.maps.admin.models.Inquiry.relations?.sourceUser.where).toEqual(ruleA);
      expect(after.maps.default.defaults?.models?.User.where).toEqual(ruleB);
      expect(after.maps.admin.defaults?.models?.User.where).toEqual(ruleB);
    });
  });

  describe('immutability', () => {
    it('does not mutate the input narrowing', () => {
      const initial = baseNarrowing();
      initial.where = ruleA;
      initial.maps.default.models.Inquiry.relations = { sourceUser: { where: ruleA } };
      initial.maps.default.defaults = { models: { User: { where: ruleA } } };
      const snapshot = structuredClone(initial);
      mergeNarrowingWheres(initial, {
        where: ruleB,
        relations: { sourceUser: ruleB },
        defaults: { User: ruleB },
      });
      expect(initial).toEqual(snapshot);
    });
  });
});
