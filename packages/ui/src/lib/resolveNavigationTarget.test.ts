/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import {
  navigationTargetHref,
  resolveNavigationTarget,
} from '@template/ui/lib/resolveNavigationTarget';

const current = { search: '?org=o1&space=s1&flow=f1&tab=x', hash: '', spoofUserEmail: null };

describe('resolveNavigationTarget', () => {
  it('context keeps org and space and drops the flow', () => {
    expect(resolveNavigationTarget('/settings', 'context', current).search).toEqual({
      org: 'o1',
      space: 's1',
    });
  });

  it('flow keeps org, space and the flow', () => {
    expect(resolveNavigationTarget('/settings?tab=hosting', 'flow', current).search).toEqual({
      tab: 'hosting',
      org: 'o1',
      space: 's1',
      flow: 'f1',
    });
  });

  it('spoof keeps only the spoofed user', () => {
    expect(
      resolveNavigationTarget('/dashboard', 'spoof', { ...current, spoofUserEmail: 'a@b.c' })
        .search,
    ).toEqual({ spoof: 'a@b.c' });
  });

  it('carries the current hash unless the target names one', () => {
    const withHash = { ...current, hash: '#section' };
    expect(resolveNavigationTarget('/a', 'context', withHash).hash).toBe('#section');
    expect(resolveNavigationTarget('/a#other', 'context', withHash).hash).toBe('#other');
  });

  it('builds the href the navigation lands on', () => {
    expect(navigationTargetHref(resolveNavigationTarget('/a?b=1', 'flow', current))).toBe(
      '/a?b=1&org=o1&space=s1&flow=f1',
    );
  });
});
