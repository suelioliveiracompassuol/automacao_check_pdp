import { render, screen, fireEvent, within } from '@testing-library/react';
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

  it('usa "Todas" para marca e "Todos" para país', () => {
    render(<FilterBar {...defaultProps} />);
    const vendors = screen.getByRole('group', { name: 'Filtrar por marca' });
    const countries = screen.getByRole('group', { name: 'Filtrar por país' });
    expect(within(vendors).getByRole('button', { name: 'Todas' })).toBeInTheDocument();
    expect(within(countries).getByRole('button', { name: 'Todos' })).toBeInTheDocument();
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

  it('renders country flags as decorative images next to the country code', () => {
    const { container } = render(<FilterBar {...defaultProps} />);
    const flags = container.querySelectorAll('img[alt=""]');
    expect(flags.length).toBeGreaterThan(0);
  });

  it('exposes the selected status via aria-pressed', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Aprovados' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onVendorChange when clicking a vendor', () => {
    const onVendorChange = vi.fn();
    render(<FilterBar {...defaultProps} onVendorChange={onVendorChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Avon:/ }));
    expect(onVendorChange).toHaveBeenCalledWith('avon');
  });

  it('mostra a contagem de PDPs e de falhas em cada opção', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Natura: 2 PDPs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avon: 1 PDP, 1 com falha' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Argentina: 1 PDP, 1 com falha' }),
    ).toBeInTheDocument();
  });

  it('desabilita países sem PDPs para a marca selecionada, em vez de escondê-los', () => {
    render(<FilterBar {...defaultProps} selectedVendor="avon" />);
    expect(screen.getByRole('button', { name: 'Brasil: 0 PDPs' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Argentina: 1 PDP, 1 com falha' })).toBeEnabled();
  });

  it('mantém o país ao trocar para uma marca que tem esse país', () => {
    const onOperationChange = vi.fn();
    render(
      <FilterBar {...defaultProps} selectedOperation="BR" onOperationChange={onOperationChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Natura:/ }));
    expect(onOperationChange).not.toHaveBeenCalled();
  });

  it('zera o país ao trocar para uma marca que não tem esse país', () => {
    const onOperationChange = vi.fn();
    render(
      <FilterBar {...defaultProps} selectedOperation="BR" onOperationChange={onOperationChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Avon:/ }));
    expect(onOperationChange).toHaveBeenCalledWith('all');
  });

  it('esconde o filtro de marca quando o relatório só tem uma marca', () => {
    render(
      <FilterBar {...defaultProps} results={mockResults.filter((r) => r.vendor === 'natura')} />,
    );
    expect(screen.queryByRole('group', { name: 'Filtrar por marca' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filtrar por país' })).toBeInTheDocument();
  });

  it('separa o Minha Loja das marcas: Avon e Natura contam só o site', () => {
    const minhaLoja: PdpCheckResult = {
      ...mockResults[0],
      sku: 'SKU-ML',
      vendor: 'avon',
      country: 'br',
      channel: 'socialcommerce',
    };
    const onVendorChange = vi.fn();
    render(
      <FilterBar
        {...defaultProps}
        results={[...mockResults, minhaLoja]}
        onVendorChange={onVendorChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Avon: 1 PDP, 1 com falha' })).toBeInTheDocument();
    const option = screen.getByRole('button', { name: 'Minha Loja: 1 PDP' });
    fireEvent.click(option);
    expect(onVendorChange).toHaveBeenCalledWith('minhaloja');
  });
});
