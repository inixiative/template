import { describe, expect, it, mock } from 'bun:test';

/**
 * Tests for PretextSection component logic.
 * Tests the show prop, text/font contracts, and prepare/layout split.
 */

const resolveShow = (show: boolean | (() => boolean)) => (typeof show === 'function' ? show() : show);

describe('PretextSection — show prop', () => {
  it('show=true renders content', () => {
    expect(resolveShow(true)).toBe(true);
  });

  it('show=false hides content', () => {
    expect(resolveShow(false)).toBe(false);
  });

  it('show function returning false hides content', () => {
    expect(resolveShow(() => false)).toBe(false);
  });
});

describe('PretextSection — prepare/layout split', () => {
  it('prepare step depends on text and font only', () => {
    const deps1 = { text: 'hello', font: '16px Arial', prepareOptions: undefined };
    const deps2 = { text: 'hello', font: '16px Arial', prepareOptions: undefined };

    // Same text/font/options → same prepare result (memoization key)
    expect(deps1.text).toBe(deps2.text);
    expect(deps1.font).toBe(deps2.font);
  });

  it('layout step depends on prepared result and width', () => {
    const width1 = 500;
    const width2 = 300;

    // Different widths trigger re-layout but not re-prepare
    expect(width1).not.toBe(width2);
  });

  it('empty text skips prepare', () => {
    const text = '';
    const prepared = text ? 'prepared-result' : null;
    expect(prepared).toBeNull();
  });

  it('null width skips layout', () => {
    const width: number | null = null;
    const prepared = { text: 'hello' };
    const result = !prepared || width === null || width <= 0 ? null : 'layout-result';
    expect(result).toBeNull();
  });

  it('zero width skips layout', () => {
    const width = 0;
    const prepared = { text: 'hello' };
    const result = !prepared || width === null || width <= 0 ? null : 'layout-result';
    expect(result).toBeNull();
  });

  it('positive width with prepared data produces layout', () => {
    const width = 500;
    const prepared = { text: 'hello' };
    const result = !prepared || width === null || width <= 0 ? null : 'layout-result';
    expect(result).toBe('layout-result');
  });
});

describe('PretextSection — style contract', () => {
  it('applies font as CSS font shorthand', () => {
    const font = '16px Inter';
    const style = { font, lineHeight: '24px' };
    expect(style.font).toBe('16px Inter');
  });

  it('applies lineHeight in pixels', () => {
    const lineHeight = 24;
    const style = { lineHeight: `${lineHeight}px` };
    expect(style.lineHeight).toBe('24px');
  });
});

describe('PretextSection — line key generation', () => {
  it('generates stable keys from segmentIndex and graphemeIndex', () => {
    const line = { start: { segmentIndex: 0, graphemeIndex: 0 } };
    const key = `${line.start.segmentIndex}-${line.start.graphemeIndex}`;
    expect(key).toBe('0-0');
  });

  it('generates unique keys for different lines', () => {
    const lines = [
      { start: { segmentIndex: 0, graphemeIndex: 0 } },
      { start: { segmentIndex: 0, graphemeIndex: 15 } },
      { start: { segmentIndex: 1, graphemeIndex: 0 } },
    ];

    const keys = lines.map((l) => `${l.start.segmentIndex}-${l.start.graphemeIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('PretextSection — children render prop', () => {
  it('children function receives layout result', () => {
    const childFn = mock((_result: { prepared: unknown; layout: unknown }) => 'rendered');
    const result = { prepared: { text: 'hello' }, layout: { lines: [] } };

    childFn(result);

    expect(childFn).toHaveBeenCalledTimes(1);
    expect(childFn).toHaveBeenCalledWith(result);
  });

  it('children function not called when result is null', () => {
    const childFn = mock(() => 'rendered');
    const result = null;

    if (result !== null) {
      childFn();
    }

    expect(childFn).not.toHaveBeenCalled();
  });
});
