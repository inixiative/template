/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { CardContent } from '@template/ui/components/primitives/Card';
import { List } from '@template/ui/components/primitives/List';
import { skeletonAttributes } from '@template/ui/components/primitives/skeletonAttributes';
import { Table } from '@template/ui/components/primitives/Table';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(cleanup);

type Row = { id: string; name: string; role: string };
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
];

describe('Table', () => {
  test('a loading table keeps its header and draws skeleton rows, never the empty state', () => {
    const { container } = render(
      <Table<Row> columns={columns} data={[]} keyExtractor={(row) => row.id} isLoading />,
    );
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(container.querySelectorAll('tbody:first-of-type td')).toHaveLength(2);
    expect(container.querySelector('tbody[data-skeleton][inert]')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(screen.getByRole('status').closest('[inert]')).toBeNull();
  });

  test("a column's skeleton is drawn while loading and kept invisibly under each loaded cell", () => {
    const badgeColumns = [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role', skeleton: <span data-testid="role-shape">role</span> },
    ];
    const { container, rerender } = render(
      <Table<Row> columns={badgeColumns} data={[]} keyExtractor={(row) => row.id} isLoading />,
    );
    expect(screen.getAllByTestId('role-shape')).toHaveLength(5);
    rerender(
      <Table<Row>
        columns={badgeColumns}
        data={[{ id: '1', name: 'Ada', role: 'owner' }]}
        keyExtractor={(row) => row.id}
        isLoading={false}
      />,
    );
    const shape = screen.getByTestId('role-shape').parentElement as HTMLElement;
    expect(shape.className).toContain('invisible');
    expect(screen.getByText('owner')).toBeTruthy();
    expect(container.querySelector('tbody[data-skeleton]')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  test('the loading cue is one status region that stays mounted and empties once loaded', () => {
    const { rerender } = render(
      <Table<Row> columns={columns} data={[]} keyExtractor={(row) => row.id} isLoading />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading…');
    rerender(
      <Table<Row>
        columns={columns}
        data={[{ id: '1', name: 'Ada', role: 'owner' }]}
        keyExtractor={(row) => row.id}
        isLoading={false}
      />,
    );
    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe('');
  });

  test('an item drawn as several rows gets its own tbody, loading and loaded', () => {
    const rows = (name: string) => (
      <>
        <tr>
          <td>{name} source</td>
        </tr>
        <tr>
          <td>{name} target</td>
        </tr>
      </>
    );
    const { container, rerender } = render(
      <Table<Row>
        columns={columns}
        data={[]}
        keyExtractor={(row) => row.id}
        isLoading
        renderItemRows={(row) => rows(row.name)}
        skeletonItemRows={rows('skeleton')}
      />,
    );
    expect(container.querySelectorAll('tbody[data-skeleton][inert]')).toHaveLength(5);
    expect(container.querySelectorAll('tbody[data-skeleton] tr')).toHaveLength(10);
    rerender(
      <Table<Row>
        columns={columns}
        data={[
          { id: '1', name: 'Ada', role: 'owner' },
          { id: '2', name: 'Alan', role: 'member' },
        ]}
        keyExtractor={(row) => row.id}
        isLoading={false}
        renderItemRows={(row) => rows(row.name)}
        skeletonItemRows={rows('skeleton')}
      />,
    );
    expect(container.querySelectorAll('tbody')).toHaveLength(2);
    expect(container.querySelector('tbody[data-key="2"]')?.textContent).toBe(
      'Alan sourceAlan target',
    );
    expect(screen.getByText('Name')).toBeTruthy();
  });

  test('the same table shows its rows once loaded', () => {
    render(
      <Table<Row>
        columns={columns}
        data={[{ id: '1', name: 'Ada', role: 'owner' }]}
        keyExtractor={(row) => row.id}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Ada')).toBeTruthy();
  });
});

describe('List', () => {
  test('a loading list draws skeleton items, not its empty message', () => {
    const { container } = render(
      <List<Row>
        items={[]}
        isLoading
        emptyMessage="No rows"
        renderItem={(row) => <li key={row.id}>{row.name}</li>}
      />,
    );
    expect(screen.queryByText('No rows')).toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  test('a loading list draws its skeleton item three times', () => {
    render(
      <List<Row>
        items={[]}
        isLoading
        skeletonItem={<li data-testid="row-shape">row</li>}
        renderItem={(row) => <li key={row.id}>{row.name}</li>}
      />,
    );
    expect(screen.getAllByTestId('row-shape')).toHaveLength(3);
  });

  test('a loaded empty list shows its empty message', () => {
    render(
      <List<Row>
        items={[]}
        emptyMessage="No rows"
        renderItem={(row) => <li key={row.id}>{row.name}</li>}
      />,
    );
    expect(screen.getByText('No rows')).toBeTruthy();
  });
});

describe('CardContent', () => {
  test('loading content draws its children as a skeleton, keeping their shape', () => {
    const { container } = render(
      <CardContent isLoading>
        <button type="button">Save</button>
      </CardContent>,
    );
    expect(container.querySelector('[data-skeleton][inert] button')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  test('content never given a loading state has no status region', () => {
    render(
      <CardContent>
        <p>Ready</p>
      </CardContent>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('loading content with no renderable children draws skeleton lines', () => {
    const { container } = render(<CardContent isLoading>{false}</CardContent>);
    const content = container.querySelector('[data-skeleton]') as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.querySelectorAll('p').length).toBeGreaterThan(0);
  });
});

describe('skeletonAttributes', () => {
  test('marks an element only while loading, so the element itself never changes', () => {
    expect(skeletonAttributes(true)).toEqual({ inert: true, 'data-skeleton': '' });
    expect(skeletonAttributes(false)).toEqual({ inert: undefined, 'data-skeleton': undefined });
  });
});
