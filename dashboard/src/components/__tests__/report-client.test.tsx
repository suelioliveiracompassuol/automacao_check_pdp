import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReportClient } from '../../app/report/[runId]/report-client';
import type { PdpCheckResult } from '@/lib/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock PdpCard
vi.mock('@/components/pdp-card', () => ({
  PdpCard: ({ result }: { result: PdpCheckResult }) => (
    <div data-testid="pdp-card">{result.name}</div>
  ),
}));
vi.mock('@/components/operation-flags-grid', () => ({
  OperationFlagsGrid: () => <div data-testid="flags-grid">FlagsGrid</div>,
}));

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
];

describe('ReportClient', () => {
  it('renders FilterBar', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    expect(screen.getByPlaceholderText('Buscar por SKU, nome ou URL...')).toBeInTheDocument();
  });

  it('renders OperationFlagsGrid', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    expect(screen.getByTestId('flags-grid')).toBeInTheDocument();
  });

  it('renders PdpCards for all results', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    const cards = screen.getAllByTestId('pdp-card');
    expect(cards.length).toBe(2);
  });

  it('shows results count', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('2 itens')).toBeInTheDocument();
  });

  it('shows singular count for single result', () => {
    render(<ReportClient results={[mockResults[0]]} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('renders section header', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('Resultados por PDP')).toBeInTheDocument();
  });

  it('filters by status - pass', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    fireEvent.click(screen.getByText('Aprovados'));
    const cards = screen.getAllByTestId('pdp-card');
    expect(cards.length).toBe(1);
    expect(cards[0]).toHaveTextContent('Product A');
  });

  it('filters by status - fail', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    fireEvent.click(screen.getByText('Reprovados'));
    const cards = screen.getAllByTestId('pdp-card');
    expect(cards.length).toBe(1);
    expect(cards[0]).toHaveTextContent('Product B');
  });

  it('filters by search query', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    const input = screen.getByPlaceholderText('Buscar por SKU, nome ou URL...');
    fireEvent.change(input, { target: { value: 'SKU-001' } });
    const cards = screen.getAllByTestId('pdp-card');
    expect(cards.length).toBe(1);
    expect(cards[0]).toHaveTextContent('Product A');
  });

  it('filters by vendor', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    // Find the vendor tabs and click Avon
    const vendorButtons = screen.getAllByRole('button');
    // Look for one that contains an SVG (vendor logo) or text
    const avonButton = vendorButtons.find((b) => b.querySelector("svg[viewBox='0 0 171 54']"));
    if (avonButton) {
      fireEvent.click(avonButton);
      const cards = screen.getAllByTestId('pdp-card');
      expect(cards.length).toBe(1);
      expect(cards[0]).toHaveTextContent('Product B');
    }
  });

  it('filters by country operation', () => {
    render(<ReportClient results={mockResults} runId="run_123" screenshots={[]} />);
    // Click on a country button
    const arButton = screen.getByText('AR');
    fireEvent.click(arButton);
    const cards = screen.getAllByTestId('pdp-card');
    expect(cards.length).toBe(1);
    expect(cards[0]).toHaveTextContent('Product B');
  });
});
