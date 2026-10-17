/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { SearchableSelect } from '@template/ui/components/primitives/SearchableSelect';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

const people = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
  { value: 'grace', label: 'Grace Hopper' },
];

const Harness = ({
  onChange,
  onSearch,
  options = people,
}: {
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  options?: typeof people;
}) => {
  const [value, setValue] = useState('');
  return (
    <SearchableSelect
      aria-label="Person"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      onSearch={onSearch}
      placeholder="Choose a person"
    />
  );
};

const openPopover = async () => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Person' }));
  return waitFor(() => screen.getByPlaceholderText('Search…'));
};

afterEach(cleanup);

describe('SearchableSelect', () => {
  test('filters options locally by label and selects one', async () => {
    const onChange = mock((_value: string) => {});
    render(<Harness onChange={onChange} />);

    const search = await openPopover();
    fireEvent.change(search, { target: { value: 'gra' } });

    await waitFor(() => expect(screen.queryByText('Ada Lovelace')).toBeNull());
    fireEvent.click(screen.getByText('Grace Hopper'));

    expect(onChange).toHaveBeenCalledWith('grace');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Person' }).textContent).toContain(
        'Grace Hopper',
      ),
    );
  });

  test('shows the empty state when nothing matches', async () => {
    render(<Harness />);
    const search = await openPopover();
    fireEvent.change(search, { target: { value: 'zzz' } });
    await waitFor(() => screen.getByText('No results found.'));
  });

  test('delegates search to onSearch without filtering locally', async () => {
    const onSearch = mock((_query: string) => {});
    render(<Harness onSearch={onSearch} />);

    const search = await openPopover();
    fireEvent.change(search, { target: { value: 'gra' } });

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(onSearch).toHaveBeenLastCalledWith('gra');
  });

  test('keeps the selected label when server results no longer include it', async () => {
    const { rerender } = render(<Harness onSearch={() => {}} />);
    await openPopover();
    fireEvent.click(screen.getByText('Alan Turing'));

    rerender(<Harness onSearch={() => {}} options={people.slice(0, 1)} />);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Person' }).textContent).toContain('Alan Turing'),
    );
  });
});
