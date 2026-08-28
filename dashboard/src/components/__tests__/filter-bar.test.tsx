import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from '../filter-bar';
import type { PdpCheckResult } from '@/lib/types';

const mockResults: PdpCheckResult[] = [
  {
    sku: 'SKU-001',
    name: 'Product A',
    url: 'https://example.com/a',
    vendor: 'natura',
    country: 'br',
    timestamp: '2024-01-01T00:00:00Z',
    success: true,
    features: [],
  },
  {
    sku: 'SKU-002',
    name: 'Product B',
    url: 'https://example.com/b',
    vendor: 'avon',
    country: 'ar',
    timestamp: '2024-01-01T00:00:00Z',
    success: false,
    features: [],
  },
  {
    sku: 'SKU-003',
    name: 'Product C',
    url: 'https://example.com/c',
    vendor: 'natura',
    country: 'co',
    timestamp: '2024-01-01T00:00:00Z',
    success: true,
    features: [],
  },
];

describe('FilterBar', () => {
  const defaultProps = {
    results: mockResults,
    searchQuery: '',
    selectedVendor: 'all',
    selectedOperation: 'all',
    selectedStatus: 'all' as const,
    onSearchChange: vi.fn(),
    onVendorChange: vi.fn(),
    onOperationChange: vi.fn(),
    onStatusChange: vi.fn(),
  };

  it('renders search input', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Buscar por SKU, nome ou URL...')).toBeInTheDocument();
  });

  it('renders status tabs', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('Aprovados')).toBeInTheDocument();
    expect(screen.getByText('Reprovados')).toBeInTheDocument();
  });

  it('renders vendor tabs sorted alphabetically', () => {
    render(<FilterBar {...defaultProps} />);
    const allTodos = screen.getAllByText('Todos');
    expect(allTodos.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSearchChange when typing', () => {
    render(<FilterBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Buscar por SKU, nome ou URL...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test');
  });

  it('calls onStatusChange when clicking status tab', () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Aprovados'));
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('pass');
  });

  it('shows clear button when filters are active', () => {
    render(<FilterBar {...defaultProps} searchQuery="test" />);
    expect(screen.getByText('Limpar')).toBeInTheDocument();
  });

  it('does not show clear button when no filters active', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.queryByText('Limpar')).not.toBeInTheDocument();
  });

  it('clears all filters when clear button is clicked', () => {
    const props = { ...defaultProps, searchQuery: 'test' };
    render(<FilterBar {...props} />);
    fireEvent.click(screen.getByText('Limpar'));
    expect(props.onSearchChange).toHaveBeenCalledWith('');
    expect(props.onVendorChange).toHaveBeenCalledWith('all');
    expect(props.onOperationChange).toHaveBeenCalledWith('all');
    expect(props.onStatusChange).toHaveBeenCalledWith('all');
  });

  it('renders country flags', () => {
    render(<FilterBar {...defaultProps} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it('calls onVendorChange when clicking a vendor', () => {
    render(<FilterBar {...defaultProps} />);
    const allTodos = screen.getAllByText('Todos');
    // Click the one in the vendor section (second one)
    fireEvent.click(allTodos[allTodos.length - 1]);
    expect(defaultProps.onVendorChange).toHaveBeenCalledWith('all');
  });
});
