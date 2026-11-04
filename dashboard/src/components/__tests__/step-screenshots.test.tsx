import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepScreenshots } from '../step-screenshots';

// Mock radix dialog
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Overlay: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  Content: ({ children, ...props }: React.PropsWithChildren) => <div {...props}>{children}</div>,
  Title: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Close: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));

const steps = [
  { label: 'PDP aberta', path: 'screenshots/NATBRA-1/01-pdp-aberta.png' },
  {
    label: 'Vitrine mais produtos da marca',
    path: 'screenshots/NATBRA-1/02-vitrine-mais-produtos-da-marca.png',
  },
];

describe('StepScreenshots', () => {
  it('renders nothing without steps', () => {
    const { container } = render(<StepScreenshots steps={[]} runId="run_123" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders one numbered thumbnail per step, in order', () => {
    render(<StepScreenshots steps={steps} runId="run_123" />);
    expect(screen.getByText('1. PDP aberta')).toBeInTheDocument();
    expect(screen.getByText('2. Vitrine mais produtos da marca')).toBeInTheDocument();
    expect(screen.getByAltText('PDP aberta').getAttribute('src')).toContain(
      '/reports/run_123/screenshots/NATBRA-1/01-pdp-aberta.png',
    );
  });

  it('opens the zoom dialog with the clicked step', () => {
    render(<StepScreenshots steps={steps} runId="run_123" />);
    fireEvent.click(screen.getByText('2. Vitrine mais produtos da marca'));
    expect(screen.getAllByText('2. Vitrine mais produtos da marca').length).toBeGreaterThan(1);
  });

  it('the opened dialog is a carousel over every step', () => {
    render(<StepScreenshots steps={steps} runId="run_123" />);
    fireEvent.click(screen.getByText('1. PDP aberta'));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imagem anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima imagem' })).toBeDisabled();

    // Unzoomed, the left arrow goes back
    fireEvent.keyDown(screen.getByText('2 / 2'), { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Thumbnails jump straight to a step
    fireEvent.click(screen.getByRole('button', { name: '2. Vitrine mais produtos da marca' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('a single step opens without carousel controls', () => {
    render(<StepScreenshots steps={steps.slice(0, 1)} runId="run_123" />);
    fireEvent.click(screen.getByText('1. PDP aberta'));
    expect(screen.queryByRole('button', { name: 'Próxima imagem' })).not.toBeInTheDocument();
  });
});
