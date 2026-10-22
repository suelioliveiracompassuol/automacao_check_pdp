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
});
