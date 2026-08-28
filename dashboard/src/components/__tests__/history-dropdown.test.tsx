import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoryDropdown } from '../history-dropdown';
import type { ReportIndexEntry } from '@/lib/types';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: React.PropsWithChildren<{
    href: string;
    onClick?: () => void;
    className?: string;
  }>) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const mockRuns: ReportIndexEntry[] = [
  {
    runId: 'run_1',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T10:05:00Z',
    durationMs: 300000,
    summary: { total: 5, passed: 4, failed: 1, errors: 0 },
    htmlPath: 'reports/run_1/report.html',
    jsonPath: 'reports/run_1/report.json',
  },
  {
    runId: 'run_2',
    startTime: '2024-01-14T10:00:00Z',
    endTime: '2024-01-14T10:03:00Z',
    durationMs: 180000,
    summary: { total: 5, passed: 5, failed: 0, errors: 0 },
    htmlPath: 'reports/run_2/report.html',
    jsonPath: 'reports/run_2/report.json',
  },
];

describe('HistoryDropdown', () => {
  it('renders history button', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    expect(screen.getByText('Histórico')).toBeInTheDocument();
  });

  it('does not show dropdown initially', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    expect(screen.queryByText('Execuções recentes')).not.toBeInTheDocument();
  });

  it('opens dropdown on button click', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    fireEvent.click(screen.getByText('Histórico'));
    expect(screen.getByText('Execuções recentes')).toBeInTheDocument();
  });

  it('displays run entries when open', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    fireEvent.click(screen.getByText('Histórico'));

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(2);
  });

  it('closes dropdown on second click', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    fireEvent.click(screen.getByText('Histórico'));
    expect(screen.getByText('Execuções recentes')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Histórico'));
    expect(screen.queryByText('Execuções recentes')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    render(
      <div>
        <span data-testid="outside">Outside</span>
        <HistoryDropdown runs={mockRuns} />
      </div>,
    );
    fireEvent.click(screen.getByText('Histórico'));
    expect(screen.getByText('Execuções recentes')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Execuções recentes')).not.toBeInTheDocument();
  });

  it('highlights current run', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    fireEvent.click(screen.getByText('Histórico'));

    const links = screen.getAllByRole('link');

    expect(links[0]).toHaveClass('bg-blue-50');
  });

  it('first entry links to home (/)', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    fireEvent.click(screen.getByText('Histórico'));
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/');
  });

  it('second entry links to /report/{runId}/', () => {
    render(<HistoryDropdown runs={mockRuns} />);
    fireEvent.click(screen.getByText('Histórico'));
    const links = screen.getAllByRole('link');
    expect(links[1]).toHaveAttribute('href', '/report/run_2/');
  });
});
