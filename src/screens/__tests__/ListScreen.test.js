import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ListScreen from '../ListScreen';

// useFavorites reads from AsyncStorage — mock it to isolate the component
jest.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: jest.fn(),
  }),
}));

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

  it('shows skeleton cards when loading is true', () => {
    const { queryByText } = render(
      <ListScreen bathrooms={[]} loading={true} onSelectBathroom={() => {}} />
    );
    // Skeletons are accessibility-hidden; no loading text rendered
    expect(queryByText('No restrooms found')).toBeNull();
  });

  it('shows empty state when no bathrooms are available', () => {
    const { getByText } = render(
      <ListScreen bathrooms={[]} loading={false} onSelectBathroom={() => {}} />
    );
    expect(getByText('No restrooms found')).toBeTruthy();
  });

  it('shows Favorites tab', () => {
    const { getByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    expect(getByText('Favorites')).toBeTruthy();
  });

  it('shows favorites empty state when Favorites tab is active and no favorites exist', () => {
    const { getByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('Favorites'));
    expect(getByText('No favorites yet')).toBeTruthy();
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
    // First role="button" is the search clear; find card buttons
    const buttons = getAllByRole('button');
    // Tap the first bathroom card (button with accessibilityHint "Double tap to view details")
    const cardBtn = buttons.find((b) =>
      b.props.accessibilityHint === 'Double tap to view details'
    );
    fireEvent.press(cardBtn);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows All tab and switches back to full list', () => {
    const { getByText } = render(
      <ListScreen bathrooms={BATHROOMS} loading={false} onSelectBathroom={() => {}} />
    );
    fireEvent.press(getByText('Favorites'));
    fireEvent.press(getByText('All'));
    expect(getByText('Alpha Restroom')).toBeTruthy();
    expect(getByText('Beta Restroom')).toBeTruthy();
    expect(getByText('Gamma Restroom')).toBeTruthy();
  });
});
