import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PdpCard } from '../pdp-card';
import type { PdpCheckResult } from '@/lib/types';

// Mock sub-components to simplify
vi.mock('../feature-table', () => ({
  FeatureTable: ({ pageScreenshot }: { pageScreenshot?: string }) => (
    <div data-testid="feature-table" data-page-screenshot={pageScreenshot ?? ''}>
      FeatureTable
    </div>
  ),
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

  it('shows success icon for passing results', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByRole('img', { name: 'Aprovado' })).toBeInTheDocument();
  });

  it('shows failure icon for failing results', () => {
    render(<PdpCard result={failedResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByRole('img', { name: 'Reprovado' })).toBeInTheDocument();
  });

  it('toggles expanded state on click', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    // Successful cards start collapsed
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    // After click, feature table should be visible (expanded)
    expect(screen.getByTestId('feature-table')).toBeInTheDocument();
  });

  it('labels the URL as the deep link on Android only', () => {
    const { unmount } = render(
      <PdpCard
        result={{ ...failedResult, platform: 'android' }}
        runId="run_123"
        screenshots={[]}
      />,
    );
    expect(screen.getByText('Deep link:')).toBeInTheDocument();
    unmount();
    render(<PdpCard result={failedResult} runId="run_123" screenshots={[]} />);
    expect(screen.queryByText('Deep link:')).not.toBeInTheDocument();
  });

  it('no Android com etapas do check, não oferece a tela final (as etapas já mostram)', () => {
    const failed = { ...failedResult, pageScreenshot: 'screenshots/SKU-123_1.png' };
    const { unmount } = render(
      <PdpCard
        result={{
          ...failed,
          platform: 'android',
          stepScreenshots: [{ label: 'PDP aberta', path: 'screenshots/SKU-123/01-pdp-aberta.png' }],
        }}
        runId="run_123"
        screenshots={[]}
      />,
    );
    expect(screen.getByTestId('feature-table')).toHaveAttribute('data-page-screenshot', '');
    unmount();
    // Sem etapas (ex.: o deep link falhou antes da primeira), a tela final continua
    const { unmount: unmount2 } = render(
      <PdpCard result={{ ...failed, platform: 'android' }} runId="run_123" screenshots={[]} />,
    );
    expect(screen.getByTestId('feature-table')).toHaveAttribute(
      'data-page-screenshot',
      'screenshots/SKU-123_1.png',
    );
    unmount2();
    // Web não muda
    render(<PdpCard result={failed} runId="run_123" screenshots={[]} />);
    expect(screen.getByTestId('feature-table')).toHaveAttribute(
      'data-page-screenshot',
      'screenshots/SKU-123_1.png',
    );
  });

  it('shows features percentage', () => {
    render(<PdpCard result={mockResult} runId="run_123" screenshots={[]} />);
    expect(screen.getByText('100% features ok')).toBeInTheDocument();
  });
});
