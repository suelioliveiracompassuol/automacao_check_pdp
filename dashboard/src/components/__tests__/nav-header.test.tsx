import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NavHeader } from '../nav-header';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock history dropdown
vi.mock('../history-dropdown', () => ({
  HistoryDropdown: () => <div data-testid="history-dropdown">History</div>,
}));

// Mock data module
vi.mock('@/lib/data', () => ({
  getReportIndex: () => ({
    reports: [
      {
        runId: 'run_1',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:05:00Z',
        durationMs: 300000,
        summary: { total: 5, passed: 5, failed: 0, errors: 0 },
        htmlPath: '',
        jsonPath: '',
      },
    ],
  }),
}));

describe('NavHeader', () => {
  it('renders PDP Monitor title', () => {
    render(<NavHeader />);
    expect(screen.getByText('PDP Monitor')).toBeInTheDocument();
  });

  it('renders version badge', () => {
    render(<NavHeader />);
    expect(screen.getByText('v2.0')).toBeInTheDocument();
  });

  it('renders link to home', () => {
    render(<NavHeader />);
    const link = screen.getByRole('link', { name: /PDP Monitor/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders link to SKUs page', () => {
    render(<NavHeader />);
    const link = screen.getByRole('link', { name: /SKUs/i });
    expect(link).toHaveAttribute('href', '/skus');
  });

  it('renders HistoryDropdown component', () => {
    render(<NavHeader />);
    expect(screen.getByTestId('history-dropdown')).toBeInTheDocument();
  });
});
