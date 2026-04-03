import { describe, expect, it } from 'bun:test';
import { buildPageRange } from '@template/ui/components/primitives/Pagination';

describe('buildPageRange', () => {
  it('returns empty for single page', () => {
    expect(buildPageRange(1, 1)).toEqual([]);
  });

  it('returns empty for zero pages', () => {
    expect(buildPageRange(1, 0)).toEqual([]);
  });

  it('returns [1, 2] for two pages', () => {
    expect(buildPageRange(1, 2)).toEqual([1, 2]);
  });

  it('shows all pages when total is small', () => {
    expect(buildPageRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows ellipsis when pages are far apart', () => {
    expect(buildPageRange(5, 20)).toEqual([1, '...', 4, 5, 6, '...', 20]);
  });

  it('shows no leading ellipsis when near start', () => {
    expect(buildPageRange(2, 20)).toEqual([1, 2, 3, '...', 20]);
  });

  it('shows no trailing ellipsis when near end', () => {
    expect(buildPageRange(19, 20)).toEqual([1, '...', 18, 19, 20]);
  });

  it('handles first page of many', () => {
    expect(buildPageRange(1, 20)).toEqual([1, 2, '...', 20]);
  });

  it('handles last page of many', () => {
    expect(buildPageRange(20, 20)).toEqual([1, '...', 19, 20]);
  });

  it('handles page 3 of 5 (no ellipsis needed)', () => {
    expect(buildPageRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles page 3 of 7 with default siblings', () => {
    expect(buildPageRange(3, 7)).toEqual([1, 2, 3, 4, '...', 7]);
  });

  it('respects custom siblings count', () => {
    const result = buildPageRange(10, 20, 2);
    expect(result).toEqual([1, '...', 8, 9, 10, 11, 12, '...', 20]);
  });

  it('custom siblings covers full range on small total', () => {
    const result = buildPageRange(3, 6, 2);
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('Pagination — record range calculation', () => {
  it('computes correct range for first page', () => {
    const pageSize = 20;
    const currentPage = 1;
    const totalRecords = 156;
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalRecords);
    expect(from).toBe(1);
    expect(to).toBe(20);
  });

  it('computes correct range for middle page', () => {
    const pageSize = 20;
    const currentPage = 3;
    const totalRecords = 156;
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalRecords);
    expect(from).toBe(41);
    expect(to).toBe(60);
  });

  it('computes correct range for last page (partial)', () => {
    const pageSize = 20;
    const currentPage = 8;
    const totalRecords = 156;
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalRecords);
    expect(from).toBe(141);
    expect(to).toBe(156);
  });

  it('handles small page sizes', () => {
    const pageSize = 5;
    const currentPage = 2;
    const totalRecords = 12;
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalRecords);
    expect(from).toBe(6);
    expect(to).toBe(10);
  });
});
