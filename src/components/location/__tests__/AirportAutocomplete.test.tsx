import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AirportAutocomplete } from '../AirportAutocomplete';
import { apiService, AirportLocation } from '@/services/api';

const mockAirports: AirportLocation[] = [
  {
    id: 'ap_del_vidp',
    iata_code: 'DEL',
    icao_code: 'VIDP',
    name: 'Indira Gandhi International Airport',
    city: 'New Delhi',
    state_region: 'Delhi',
    country: 'India',
    country_code: 'IN',
    latitude: 28.5562,
    longitude: 77.1000,
    timezone: 'Asia/Kolkata',
    provenance: 'REFERENCE_DATASET',
  },
  {
    id: 'ap_bom_vabb',
    iata_code: 'BOM',
    icao_code: 'VABB',
    name: 'Chhatrapati Shivaji Maharaj International Airport',
    city: 'Mumbai',
    state_region: 'Maharashtra',
    country: 'India',
    country_code: 'IN',
    latitude: 19.0896,
    longitude: 72.8656,
    timezone: 'Asia/Kolkata',
    provenance: 'REFERENCE_DATASET',
  },
];

describe('AirportAutocomplete Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders input with placeholder and label', () => {
    render(
      <AirportAutocomplete
        label="Departure Airport"
        placeholder="Type city or airport…"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Departure Airport')).toBeDefined();
    expect(screen.getByPlaceholderText('Type city or airport…')).toBeDefined();
  });

  it('handles loading state while search is in-flight', async () => {
    let resolveSearch: (val: AirportLocation[]) => void;
    const searchPromise = new Promise<AirportLocation[]>((resolve) => {
      resolveSearch = resolve;
    });

    vi.spyOn(apiService, 'searchLocations').mockReturnValue(searchPromise);

    render(<AirportAutocomplete onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'Del' } });
    });

    // Advance debounce timer
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(screen.getByTestId('airport-loading-state')).toBeDefined();

    // Resolve search
    await act(async () => {
      resolveSearch!([mockAirports[0]]);
    });

    await waitFor(() => {
      expect(screen.getByText('Indira Gandhi International Airport')).toBeDefined();
    });
  });

  it('supports keyboard navigation (ArrowDown, ArrowUp, Enter)', async () => {
    vi.spyOn(apiService, 'searchLocations').mockResolvedValue(mockAirports);
    const onSelect = vi.fn();

    render(<AirportAutocomplete onSelect={onSelect} />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'India' } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    await waitFor(() => {
      expect(screen.getAllByText('New Delhi').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Mumbai').length).toBeGreaterThan(0);
    });

    // Press ArrowDown to move to second item (Mumbai)
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });

    // Press Enter to select
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onSelect).toHaveBeenCalledWith(mockAirports[1]);
    expect((input as HTMLInputElement).value).toBe('Mumbai (BOM)');
  });

  it('handles selection on click and displays information hierarchy', async () => {
    vi.spyOn(apiService, 'searchLocations').mockResolvedValue(mockAirports);
    const onSelect = vi.fn();

    render(<AirportAutocomplete onSelect={onSelect} />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'Del' } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    await waitFor(() => {
      expect(screen.getByText('Indira Gandhi International Airport')).toBeDefined();
    });

    // Check information hierarchy: City, Airport name, Meta row
    expect(screen.getAllByText('New Delhi').length).toBeGreaterThan(0);
    expect(screen.getByText('Indira Gandhi International Airport')).toBeDefined();
    expect(screen.getByText('DEL')).toBeDefined();

    // Click on Delhi option
    act(() => {
      fireEvent.click(screen.getByText('Indira Gandhi International Airport'));
    });

    expect(onSelect).toHaveBeenCalledWith(mockAirports[0]);
    expect((input as HTMLInputElement).value).toBe('New Delhi (DEL)');
  });

  it('displays empty state when no airports match', async () => {
    vi.spyOn(apiService, 'searchLocations').mockResolvedValue([]);

    render(<AirportAutocomplete onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'nonexistent-mars-base' } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    await waitFor(() => {
      expect(screen.getByTestId('airport-empty-state')).toBeDefined();
      expect(screen.getByText('No matching airports found')).toBeDefined();
    });
  });

  it('displays error state when searchLocations fails', async () => {
    vi.spyOn(apiService, 'searchLocations').mockRejectedValue(new Error('Network error'));

    render(<AirportAutocomplete onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'ErrorTest' } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    await waitFor(() => {
      expect(screen.getByTestId('airport-error-state')).toBeDefined();
      expect(screen.getByText('Unable to load airports. Please check your connection.')).toBeDefined();
    });
  });

  it('clears selection when clear button is clicked', () => {
    const onSelect = vi.fn();
    render(<AirportAutocomplete value={mockAirports[0]} onSelect={onSelect} />);

    const clearBtn = screen.getByRole('button', { name: /clear airport input/i });
    expect(clearBtn).toBeDefined();

    act(() => {
      fireEvent.click(clearBtn);
    });

    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
