import { afterAll, describe, expect, it } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { clearHookRegistry, DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { registerTestTracker } from '@template/db/test/testTracker';
import { saveEmailTemplate } from '@template/email/render';

// saveEmailTemplate is the deterministic case in this repo where async-local storage does not
// survive into the mutation extension's continuation, so it is the only path on which restoring
// several stores at once is provably load-bearing — on a happy path these assertions would pass
// with the bridge deleted.
//
// Four stores with four different value shapes: any cross-wiring shows up as a shape mismatch and
// not merely a wrong value. Delta is declared but never entered by the caller.
type AlphaValue = { shape: 'alpha'; alphaId: string; touchedByHook: boolean };
type BetaValue = { shape: 'beta'; betaCounts: number[] };
type GammaValue = { shape: 'gamma'; gammaLabel: string };
type DeltaValue = { shape: 'delta'; deltaFlag: boolean };

const probeAlpha = new AsyncLocalStorage<AlphaValue>();
const probeBeta = new AsyncLocalStorage<BetaValue>();
const probeGamma = new AsyncLocalStorage<GammaValue>();
const probeDelta = new AsyncLocalStorage<DeltaValue>();

type Observation = {
  hook: string;
  model: string;
  alpha: AlphaValue | undefined;
  beta: BetaValue | undefined;
  gamma: GammaValue | undefined;
  delta: DeltaValue | undefined;
  isInTxn: boolean;
};

const observations: Observation[] = [];

const observe = (hook: string, model: string) => {
  observations.push({
    hook,
    model,
    alpha: probeAlpha.getStore(),
    beta: probeBeta.getStore(),
    gamma: probeGamma.getStore(),
    delta: probeDelta.getStore(),
    isInTxn: db.isInTxn(),
  });
};

registerTestTracker();

// Declared across two hooks with an overlapping subset: beta is named twice, and the stores are a
// single union applied to every hook, so hookA observes gamma even though hookB declared it.
registerDbHook(
  'probeMatrixA',
  '*',
  HookTiming.after,
  [DbAction.create],
  async ({ model }) => {
    observe('probeMatrixA', model);
    const alpha = probeAlpha.getStore();
    if (alpha) alpha.touchedByHook = true;
  },
  [probeAlpha, probeBeta],
);

registerDbHook(
  'probeMatrixB',
  '*',
  HookTiming.after,
  [DbAction.create],
  async ({ model }) => {
    observe('probeMatrixB', model);
  },
  [probeBeta, probeGamma, probeDelta],
);

afterAll(async () => {
  clearHookRegistry();
  await cleanupTouchedTables(db);
});

const emailTemplate = (slug: string) => ({
  slug,
  name: slug,
  subject: 'Hi',
  kind: 'system' as const,
  mjml: `<mjml><mj-body><mj-section><mj-column>{{#component:${slug}-greeting}}<mj-text>Hello</mj-text>{{/component:${slug}-greeting}}</mj-column></mj-section></mj-body></mjml>`,
  ownerModel: 'default' as const,
});

describe('bridged hook context across a frame that loses async-local storage', () => {
  it('keeps four simultaneously bridged stores separate, by identity, in every hook', async () => {
    const alphaValue: AlphaValue = { shape: 'alpha', alphaId: 'alpha-1', touchedByHook: false };
    const betaValue: BetaValue = { shape: 'beta', betaCounts: [1, 2, 3] };
    const gammaValue: GammaValue = { shape: 'gamma', gammaLabel: 'gamma-1' };

    await probeAlpha.run(alphaValue, () =>
      probeBeta.run(betaValue, () =>
        probeGamma.run(gammaValue, () =>
          db.txn(async () => {
            // (a) caller frame, inside db.txn: the caller sees exactly what it set.
            expect(probeAlpha.getStore()).toBe(alphaValue);
            expect(probeBeta.getStore()).toBe(betaValue);
            expect(probeGamma.getStore()).toBe(gammaValue);
            expect(probeDelta.getStore()).toBeUndefined();

            await saveEmailTemplate(emailTemplate(`bridged-matrix-${Date.now()}`));
          }),
        ),
      ),
    );

    // (b) hook frame: both hooks ran, on both email models, inside the transaction.
    expect(observations.length).toBeGreaterThan(0);
    expect(new Set(observations.map((entry) => entry.hook))).toEqual(new Set(['probeMatrixA', 'probeMatrixB']));
    expect(new Set(observations.map((entry) => entry.model))).toEqual(new Set(['EmailComponent', 'EmailTemplate']));

    for (const entry of observations) {
      const where = `${entry.hook}/${entry.model}`;

      expect(entry.isInTxn, where).toBe(true);

      // Each store hands back its own object, not a copy and not a neighbour's value.
      expect(entry.alpha, where).toBe(alphaValue);
      expect(entry.beta, where).toBe(betaValue);
      expect(entry.gamma, where).toBe(gammaValue);

      // A declared store the caller never entered stays unset rather than entered with undefined.
      expect(entry.delta, where).toBeUndefined();

      // Shape tags: cross-wiring would surface here even if two stores held equal-looking values.
      expect(entry.alpha?.shape, where).toBe('alpha');
      expect(entry.beta?.shape, where).toBe('beta');
      expect(entry.gamma?.shape, where).toBe('gamma');
    }

    // (c) caller frame after commit: still the caller's own objects, and the hook's field mutation
    // is visible because the value is shared by reference in both directions.
    expect(alphaValue.touchedByHook).toBe(true);
    expect(betaValue.betaCounts).toEqual([1, 2, 3]);
    expect(gammaValue.gammaLabel).toBe('gamma-1');
    expect(probeAlpha.getStore()).toBeUndefined();
  });
});
