import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BathroomCard from '../BathroomCard';

const BASE_BATHROOM = {
  id: 'test_1',
  name: 'Test Restroom',
  distanceLabel: '0.3 mi',
  distance: 483,
  rating: 4.0,
  fee: false,
  accessible: true,
  changingTable: false,
  openingHours: '24/7',
  unisex: false,
  male: true,
  female: true,
  description: null,
  image: null,
};

describe('BathroomCard', () => {
  it('renders the bathroom name', () => {
    const { getByText } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    expect(getByText('Test Restroom')).toBeTruthy();
  });

  it('renders the distance label', () => {
    const { getByText } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    expect(getByText('0.3 mi')).toBeTruthy();
  });

  it('renders the rating', () => {
    const { getByText } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    expect(getByText('4 / 5')).toBeTruthy();
  });

  it('shows Free badge when fee is false', () => {
    const { getByText } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    expect(getByText('Free')).toBeTruthy();
  });

  it('shows Paid badge when fee is true', () => {
    const { getByText } = render(
      <BathroomCard bathroom={{ ...BASE_BATHROOM, fee: true }} onPress={() => {}} />
    );
    expect(getByText('Paid')).toBeTruthy();
  });

  it('shows Accessible badge when accessible is true', () => {
    const { getByText } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    expect(getByText('Accessible')).toBeTruthy();
  });

  it('does not show Accessible badge when accessible is false', () => {
    const { queryByText } = render(
      <BathroomCard bathroom={{ ...BASE_BATHROOM, accessible: false }} onPress={() => {}} />
    );
    expect(queryByText('Accessible')).toBeNull();
  });

  it('shows Baby badge when changingTable is true', () => {
    const { getByText } = render(
      <BathroomCard bathroom={{ ...BASE_BATHROOM, changingTable: true }} onPress={() => {}} />
    );
    expect(getByText('Baby')).toBeTruthy();
  });

  it('shows 24/7 badge when openingHours is "24/7"', () => {
    const { getByText } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    expect(getByText('24/7')).toBeTruthy();
  });

  it('does not show 24/7 badge for other hours', () => {
    const { queryByText } = render(
      <BathroomCard
        bathroom={{ ...BASE_BATHROOM, openingHours: '08:00-20:00' }}
        onPress={() => {}}
      />
    );
    expect(queryByText('24/7')).toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={onPress} />
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has a correct accessibilityLabel including name and distance', () => {
    const { getByRole } = render(
      <BathroomCard bathroom={BASE_BATHROOM} onPress={() => {}} />
    );
    const btn = getByRole('button');
    expect(btn.props.accessibilityLabel).toContain('Test Restroom');
    expect(btn.props.accessibilityLabel).toContain('0.3 mi away');
  });
});
