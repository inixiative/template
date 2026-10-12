import { describe, expect, it } from 'bun:test';
import { type FetchAllPagesCap, fetchAllPages, type PageRequest } from '@template/shared/utils';

describe('fetchAllPages', () => {
  describe('offset pagination', () => {
    it('follows pagination.totalPages and concatenates every page', async () => {
      const calls: number[] = [];
      const items = await fetchAllPages(async ({ page }) => {
        calls.push(page);
        return { data: [`item-${page}`], pagination: { totalPages: 3 } };
      });

      expect(calls).toEqual([1, 2, 3]);
      expect(items).toEqual(['item-1', 'item-2', 'item-3']);
    });

    it('stops after one page when pagination metadata is missing', async () => {
      const calls: number[] = [];
      const items = await fetchAllPages(async ({ page }) => {
        calls.push(page);
        return { data: ['only'] };
      });

      expect(calls).toEqual([1]);
      expect(items).toEqual(['only']);
    });

    it('stops on an empty batch even when totalPages says more', async () => {
      const calls: number[] = [];
      const items = await fetchAllPages(async ({ page }) => {
        calls.push(page);
        return { data: page === 1 ? ['a'] : [], pagination: { totalPages: 10 } };
      });

      expect(calls).toEqual([1, 2]);
      expect(items).toEqual(['a']);
    });

    it('handles a null data envelope', async () => {
      expect(await fetchAllPages(async () => ({ data: null }))).toEqual([]);
    });
  });

  describe('cursor pagination', () => {
    it('passes nextCursor forward until it runs out', async () => {
      const requests: PageRequest[] = [];
      const items = await fetchAllPages(async (request) => {
        requests.push(request);
        const next = request.cursor === null ? 'c1' : request.cursor === 'c1' ? 'c2' : null;
        return { data: [request.cursor ?? 'start'], pagination: { nextCursor: next } };
      });

      expect(requests).toEqual([
        { page: 1, cursor: null },
        { page: 2, cursor: 'c1' },
        { page: 3, cursor: 'c2' },
      ]);
      expect(items).toEqual(['start', 'c1', 'c2']);
    });
  });

  describe('errors', () => {
    it('rejects when a page resolves an error envelope instead of data', async () => {
      const failing = fetchAllPages(async () => ({
        error: { message: 'You are not logged in' },
        data: undefined,
      }));

      await expect(failing).rejects.toThrow(/page 1 failed: You are not logged in/);
    });

    it('rejects mid-walk when a later page fails, instead of returning a partial set', async () => {
      const calls: number[] = [];
      const failing = fetchAllPages(async ({ page }) => {
        calls.push(page);
        if (page === 2) return { error: { message: 'boom' }, data: undefined };
        return { data: ['a'], pagination: { totalPages: 3 } };
      });

      await expect(failing).rejects.toThrow(/boom/);
      expect(calls).toEqual([1, 2]);
    });

    it('a custom isError can opt out of error detection', async () => {
      const items = await fetchAllPages<string, { error: string; data: string[] }>(
        async () => ({ error: 'a-legit-field', data: ['row'] }),
        { isError: () => undefined },
      );
      expect(items).toEqual(['row']);
    });
  });

  describe('caps', () => {
    it('respects maxPages and reports the cap', async () => {
      const calls: number[] = [];
      let cap: FetchAllPagesCap | undefined;
      const items = await fetchAllPages(
        async ({ page }) => {
          calls.push(page);
          return { data: [`row-${page}`], pagination: { totalPages: 100 } };
        },
        { maxPages: 2, onCapped: (reported) => (cap = reported) },
      );

      expect(calls).toEqual([1, 2]);
      expect(items).toEqual(['row-1', 'row-2']);
      expect(cap).toEqual({ reason: 'maxPages', returned: 2 });
    });

    it('truncates to maxRows and reports the rows actually returned', async () => {
      let cap: FetchAllPagesCap | undefined;
      const items = await fetchAllPages(
        async ({ page }) => ({ data: [`a-${page}`, `b-${page}`], pagination: { totalPages: 10 } }),
        { maxRows: 3, onCapped: (reported) => (cap = reported) },
      );

      expect(items).toEqual(['a-1', 'b-1', 'a-2']);
      expect(cap).toEqual({ reason: 'maxRows', returned: 3 });
    });

    it('does not report a cap when the walk ends exactly at maxRows', async () => {
      let capped = false;
      const items = await fetchAllPages(
        async () => ({ data: ['a', 'b'], pagination: { totalPages: 1 } }),
        { maxRows: 2, onCapped: () => (capped = true) },
      );

      expect(items).toEqual(['a', 'b']);
      expect(capped).toBe(false);
    });

    it('does not report a cap when the walk ends inside the page ceiling', async () => {
      let capped = false;
      await fetchAllPages(
        async ({ page }) => ({ data: [`row-${page}`], pagination: { totalPages: 2 } }),
        { maxPages: 50, onCapped: () => (capped = true) },
      );
      expect(capped).toBe(false);
    });
  });

  describe('custom getItems + hasMore', () => {
    it('terminates when a page returns fewer rows than the page size', async () => {
      const pages = [['a', 'b'], ['c']];
      const items = await fetchAllPages<string, { rows: string[] }>(
        async ({ page }) => ({ rows: pages[page - 1] ?? [] }),
        {
          getItems: (response) => response.rows,
          hasMore: (_response, _request, rows) => rows.length === 2,
        },
      );

      expect(items).toEqual(['a', 'b', 'c']);
    });

    it('onResponse fires once per successful page', async () => {
      const seen: number[] = [];
      await fetchAllPages(async ({ page }) => ({ data: [page], pagination: { totalPages: 2 } }), {
        onResponse: (_response, { page }) => seen.push(page),
      });
      expect(seen).toEqual([1, 2]);
    });
  });
});
