import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SummaryCards } from '../summary-cards';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('SummaryCards', () => {
  it('renders all summary values', () => {
    render(<SummaryCards total={10} passed={7} failed={2} errors={1} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders labels', () => {
    render(<SummaryCards total={5} passed={3} failed={1} errors={1} />);
    expect(screen.getByText('Total de PDPs')).toBeInTheDocument();
    expect(screen.getByText('Passou')).toBeInTheDocument();
    expect(screen.getByText('Falhou')).toBeInTheDocument();
  });

  it('handles zero values', () => {
    render(<SummaryCards total={0} passed={0} failed={0} errors={0} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4);
  });
});
