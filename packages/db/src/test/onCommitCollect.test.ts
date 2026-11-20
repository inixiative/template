import { describe, expect, it, mock } from 'bun:test';
import { db } from '@template/db';

describe('db.onCommitCollect', () => {
  it('flushes every item pushed under one key once, after commit', async () => {
    const flushed: number[][] = [];
    const flush = (items: number[]) => {
      flushed.push(items);
    };
    await db.txn(async () => {
      db.onCommitCollect('k', 1, flush);
      db.onCommitCollect('k', 2, flush);
      expect(flushed).toEqual([]);
    });
    expect(flushed).toEqual([[1, 2]]);
  });

  it('keeps different keys apart', async () => {
    const flushed: Record<string, number[]> = {};
    const flushAs = (key: string) => (items: number[]) => {
      flushed[key] = items;
    };
    await db.txn(async () => {
      db.onCommitCollect('a', 1, flushAs('a'));
      db.onCommitCollect('b', 2, flushAs('b'));
      db.onCommitCollect('a', 3, flushAs('a'));
    });
    expect(flushed).toEqual({ a: [1, 3], b: [2] });
  });

  it('collects across a nested txn into the outer one', async () => {
    const flushed: number[][] = [];
    const flush = (items: number[]) => {
      flushed.push(items);
    };
    await db.txn(async () => {
      db.onCommitCollect('k', 1, flush);
      await db.txn(async () => {
        db.onCommitCollect('k', 2, flush);
      });
    });
    expect(flushed).toEqual([[1, 2]]);
  });

  it('flushes nothing when the transaction rolls back', async () => {
    const flushed: number[][] = [];
    await expect(
      db.txn(async () => {
        db.onCommitCollect('k', 1, (items: number[]) => {
          flushed.push(items);
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(flushed).toEqual([]);
  });

  it('throws outside a transaction and never calls flush', () => {
    const flush = mock((_items: number[]) => {});
    expect(() => db.onCommitCollect('k', 1, flush)).toThrow(
      'db.onCommitCollect() requires db.txn()',
    );
    expect(flush).not.toHaveBeenCalled();
  });
});
