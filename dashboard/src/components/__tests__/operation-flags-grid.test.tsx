import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OperationFlagsGrid } from '../operation-flags-grid';
import type { PdpCheckResult } from '@/lib/types';

// Mock radix collapsible
vi.mock('@radix-ui/react-collapsible', () => ({
  Root: ({ children }: React.PropsWithChildren<{ open?: boolean }>) => <div>{children}</div>,
  Trigger: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
  Content: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

const resultsWithFlags: PdpCheckResult[] = [
  {
    sku: 'SKU-001',
    name: 'Product A',
    url: 'https://example.com/a',
    vendor: 'natura',
    country: 'br',
    timestamp: '2024-01-01T00:00:00Z',
    success: true,
    features: [],
    remoteConfigFlags: {
      show_reviews: true,
      product_recommendations: false,
      nullable_flag: null,
      product_reviews: {
        enabled: true,
        count: 10,
        recommendation: {
          enabled: false,
        },
      },
    },
    commerceFeatureFlags: {
      cart_enabled: true,
      some_number: 42,
    },
  },
  {
    sku: 'SKU-002',
    name: 'Product B',
    url: 'https://example.com/b',
    vendor: 'avon',
    country: 'ar',
    timestamp: '2024-01-01T00:00:00Z',
    success: true,
    features: [],
    remoteConfigFlags: {
      show_reviews: false,
    },
  },
];

const resultsWithoutFlags: PdpCheckResult[] = [
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
];

describe('OperationFlagsGrid', () => {
  it('renders null when no results have flags', () => {
    const { container } = render(<OperationFlagsGrid results={resultsWithoutFlags} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders section title when flags exist', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText('Feature Flags por Operação')).toBeInTheDocument();
  });

  it('shows operation count', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText('2 operações')).toBeInTheDocument();
  });

  it('renders flag keys as row headers', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const flagRows = screen.getAllByText('show_reviews');
    expect(flagRows.length).toBeGreaterThanOrEqual(1);
  });

  it('flattens nested objects with dot notation', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText('product_reviews.enabled')).toBeInTheDocument();
    expect(screen.getByText('product_reviews.recommendation.enabled')).toBeInTheDocument();
  });

  it('deduplicates operations with same key', () => {
    const duplicateResults = [
      resultsWithFlags[0],
      { ...resultsWithFlags[0], sku: 'SKU-003' }, // same vendor+country
    ];
    render(<OperationFlagsGrid results={duplicateResults} />);
    expect(screen.getByText('1 operações')).toBeInTheDocument();
  });

  it('renders one column header per operation plus the Flag column', () => {
    const { container } = render(<OperationFlagsGrid results={resultsWithFlags} />);
    // RC table has Flag + natura/br + avon/ar = 3 columns
    // Commerce table has Flag + natura/br only = 2 columns (avon/ar has no commerceFeatureFlags)
    const tables = container.querySelectorAll('table');
    const rcHeaderThs = tables[0].querySelectorAll('thead th');
    expect(rcHeaderThs.length).toBe(3);
    const commerceHeaderThs = tables[1].querySelectorAll('thead th');
    expect(commerceHeaderThs.length).toBe(2);
  });

  it('renders boolean true as checkmark', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders boolean false as X mark', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const crosses = screen.getAllByText('✗');
    expect(crosses.length).toBeGreaterThanOrEqual(1);
  });

  it('renders null/undefined as em dash', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders number values as string', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders separate tables for RC and commerce flags', () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText(/Remote Config Flags/)).toBeInTheDocument();
    expect(screen.getByText(/Commerce Feature Flags/)).toBeInTheDocument();
  });

  it("renders 'Flag' as the first column header", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const flagHeaders = screen.getAllByText('Flag');
    expect(flagHeaders.length).toBeGreaterThanOrEqual(1);
  });
});
