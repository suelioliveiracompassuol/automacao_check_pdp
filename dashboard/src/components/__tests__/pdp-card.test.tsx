import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PdpCard } from '../pdp-card';
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

// Mock sub-components to simplify
vi.mock('../feature-table', () => ({
  FeatureTable: () => <div data-testid="feature-table">FeatureTable</div>,
}));
vi.mock('../remote-config-panel', () => ({
  RemoteConfigPanel: () => <div data-testid="remote-config-panel">RemoteConfigPanel</div>,
}));
vi.mock('../screenshot-viewer', () => ({
  ScreenshotViewer: () => <div data-testid="screenshot-viewer">ScreenshotViewer</div>,
}));

const mockResult: PdpCheckResult = {
  sku: 'SKU-123',
  name: 'Test Product',
  url: 'https://example.com/product',
  vendor: 'natura',
  country: 'br',
  timestamp: '2024-01-01T00:00:00Z',
  success: true,
  loadTime: 1200,
  features: [
    {
      feature: 'Title',
      featureKey: 'title',
      passed: true,
      status: 'pass',
      message: 'OK',
    },
    {
      feature: 'Price',
      featureKey: 'price',
      passed: true,
      status: 'pass',
      message: 'OK',
    },
  ],
};

const failedResult: PdpCheckResult = {
  ...mockResult,
  success: false,
  features: [
    {
      feature: 'Title',
      featureKey: 'title',
      passed: false,
      status: 'fail',
      message: 'Not found',
    },
  ],
};

describe('PdpCard', () => {
  it('renders product name', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  it('renders SKU', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('SKU-123')).toBeInTheDocument();
  });

  it('renders load time', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('1200ms')).toBeInTheDocument();
  });

  it('shows success emoji for passing results', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('shows failure emoji for failing results', () => {
    render(<PdpCard result={failedResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('toggles expanded state on click', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    // Successful cards start collapsed
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // After click, feature table should be visible (expanded)
    expect(screen.getByTestId('feature-table')).toBeInTheDocument();
  });

  it('shows features percentage', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('100% features ok')).toBeInTheDocument();
  });
});
