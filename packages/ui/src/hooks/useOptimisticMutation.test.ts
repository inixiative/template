/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import { createOptimisticListTarget } from '@template/ui/hooks/useOptimisticMutation';

type Row = { id: string; name: string; secret?: string };

const queryKey = ['rows'];

describe('createOptimisticListTarget', () => {
  it('a create appends a placeholder, then reconciles it into the server row', () => {
    const target = createOptimisticListTarget<Row>({ queryKey, operation: 'create' });
    const pending = target.optimisticUpdate(
      { data: [{ id: 'a', name: 'A' }] },
      {
        body: { name: 'B' },
      },
    );
    expect(pending).toEqual({
      data: [
        { id: 'a', name: 'A' },
        { id: '__optimistic__', name: 'B' },
      ],
    });

    expect(target.reconcile?.(pending, { data: { id: 'b', name: 'B' } })).toEqual({
      data: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    });
  });

  it('itemFromResponse shapes the reconciled row', () => {
    const target = createOptimisticListTarget<Row, unknown, { data: Required<Row> }>({
      queryKey,
      operation: 'create',
      itemFromResponse: ({ data: { secret: _secret, ...row } }) => row,
    });
    const pending = target.optimisticUpdate([], { body: { name: 'B' } });

    expect(target.reconcile?.(pending, { data: { id: 'b', name: 'B', secret: 's3cret' } })).toEqual(
      [{ id: 'b', name: 'B' }],
    );
  });

  it('a response without a row drops the placeholder instead of leaving a ghost', () => {
    const target = createOptimisticListTarget<Row>({ queryKey, operation: 'create' });
    const pending = target.optimisticUpdate({ data: [] }, { body: { name: 'B' } });

    expect(target.reconcile?.(pending, {})).toEqual({ data: [] });
  });

  it('only a create reconciles', () => {
    expect(
      createOptimisticListTarget<Row>({ queryKey, operation: 'delete' }).reconcile,
    ).toBeUndefined();
    expect(
      createOptimisticListTarget<Row>({ queryKey, operation: 'update' }).reconcile,
    ).toBeUndefined();
  });

  describe('an infinite list', () => {
    const infinite = {
      pageParams: [1, 2],
      pages: [{ data: [{ id: 'a', name: 'A' }] }, { data: [{ id: 'b', name: 'B' }] }],
    };

    it('a create appends to the last page, then reconciles in place', () => {
      const target = createOptimisticListTarget<Row>({ queryKey, operation: 'create' });
      const pending = target.optimisticUpdate(infinite, { body: { name: 'C' } });
      expect(pending).toEqual({
        pageParams: [1, 2],
        pages: [
          { data: [{ id: 'a', name: 'A' }] },
          {
            data: [
              { id: 'b', name: 'B' },
              { id: '__optimistic__', name: 'C' },
            ],
          },
        ],
      });
      expect(target.reconcile?.(pending, { data: { id: 'c', name: 'C' } })).toEqual({
        pageParams: [1, 2],
        pages: [
          { data: [{ id: 'a', name: 'A' }] },
          {
            data: [
              { id: 'b', name: 'B' },
              { id: 'c', name: 'C' },
            ],
          },
        ],
      });
    });

    it('an update and a delete reach the row on any page', () => {
      const update = createOptimisticListTarget<Row>({ queryKey, operation: 'update' });
      expect(
        update.optimisticUpdate(infinite, { path: { id: 'a' }, body: { name: 'A2' } }),
      ).toEqual({
        pageParams: [1, 2],
        pages: [{ data: [{ id: 'a', name: 'A2' }] }, { data: [{ id: 'b', name: 'B' }] }],
      });
      const remove = createOptimisticListTarget<Row>({ queryKey, operation: 'delete' });
      expect(remove.optimisticUpdate(infinite, { path: { id: 'b' } })).toEqual({
        pageParams: [1, 2],
        pages: [{ data: [{ id: 'a', name: 'A' }] }, { data: [] }],
      });
    });
  });
});
