import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ListScreen from '../ListScreen';

const makeBathroom = (overrides = {}) => ({
  id: 'b1',
  name: 'Test Restroom',
  distanceLabel: '0.2 mi',
  distance: 322,
  rating: 3.5,
  fee: false,
  accessible: false,
  changingTable: false,
  openingHours: null,
  image: null,
  ...overrides,
});

const BATHROOMS = [
  makeBathroom({ id: 'b1', name: 'Alpha Restroom', distance: 100, distanceLabel: '328 ft', fee: false }),
  makeBathroom({ id: 'b2', name: 'Beta Restroom',  distance: 500, distanceLabel: '0.3 mi', fee: true, accessible: true }),
  makeBathroom({ id: 'b3', name: 'Gamma Restroom', distance: 800, distanceLabel: '0.5 mi', openingHours: '24/7' }),
];

describe('ListScreen', () => {
  it('renders all bathrooms by default', () => {
    const { getByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    expect(getByText('Alpha Restroom')).toBeTruthy();
    expect(getByText('Beta Restroom')).toBeTruthy();
    expect(getByText('Gamma Restroom')).toBeTruthy();
  });

  it('shows a loading indicator when loading is true', () => {
    const { getByText } = render(
      <ListScreen bathrooms={[]} loading={true} onSelectBathroom={() => {}} />
    );
    expect(getByText('Searching nearby...')).toBeTruthy();
  });

  it('shows empty state when no bathrooms match', () => {
    const { getByText } = render(
      <ListScreen bathrooms={[]} loading={false} onSelectBathroom={() => {}} />
    );
    expect(getByText('No restrooms found')).toBeTruthy();
  });

  it('filters to free restrooms when Free filter is pressed', () => {
    const { getByText, queryByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('Free'));
    expect(getByText('Alpha Restroom')).toBeTruthy();
    expect(queryByText('Beta Restroom')).toBeNull(); // paid
  });

  it('filters to accessible restrooms when Accessible filter is pressed', () => {
    const { getByText, queryByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('Accessible'));
    expect(getByText('Beta Restroom')).toBeTruthy();
    expect(queryByText('Alpha Restroom')).toBeNull();
    expect(queryByText('Gamma Restroom')).toBeNull();
  });

  it('filters to 24/7 restrooms when 24/7 filter is pressed', () => {
    const { getByText, queryByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('24/7'));
    expect(getByText('Gamma Restroom')).toBeTruthy();
    expect(queryByText('Alpha Restroom')).toBeNull();
    expect(queryByText('Beta Restroom')).toBeNull();
  });

  it('shows empty state hint about filter when active filter yields no results', () => {
    const paidOnly = [makeBathroom({ id: 'x', name: 'Paid Only', fee: true })];
    const { getByText } = render(
      <ListScreen bathrooms={paidOnly} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('Free'));
    expect(getByText('Try changing your filter')).toBeTruthy();
  });

  it('filters by search text', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    const input = getByPlaceholderText('Search restrooms...');
    fireEvent.changeText(input, 'alpha');
    expect(getByText('Alpha Restroom')).toBeTruthy();
    expect(queryByText('Beta Restroom')).toBeNull();
    expect(queryByText('Gamma Restroom')).toBeNull();
  });

  it('search is case-insensitive', () => {
    const { getByPlaceholderText, getByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.changeText(getByPlaceholderText('Search restrooms...'), 'BETA');
    expect(getByText('Beta Restroom')).toBeTruthy();
  });

  it('calls onSelectBathroom when a card is pressed', () => {
    const onSelect = jest.fn();
    const { getAllByRole } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={onSelect} />
    );
    fireEvent.press(getAllByRole('button')[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
  });

  it('resets to All when All filter is pressed after another filter', () => {
    const { getByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('Free'));
    fireEvent.press(getByText('All'));
    expect(getByText('Alpha Restroom')).toBeTruthy();
    expect(getByText('Beta Restroom')).toBeTruthy();
    expect(getByText('Gamma Restroom')).toBeTruthy();
  });
});
