import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RemoteConfigPanel } from '../remote-config-panel';

// Mock radix collapsible
vi.mock('@radix-ui/react-collapsible', () => ({
  Root: ({
    children,
    open,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }>) => <div data-open={open}>{children}</div>,
  Trigger: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
  Content: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

describe('RemoteConfigPanel', () => {
  it('renders null when flags is undefined', () => {
    const { container } = render(<RemoteConfigPanel flags={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders flat flag entries', () => {
    const flags = {
      show_reviews: true,
      show_recommendations: false,
      max_items: 5,
    };
    render(<RemoteConfigPanel flags={flags} />);
    expect(screen.getByText('show_reviews')).toBeInTheDocument();
    expect(screen.getByText('show_recommendations')).toBeInTheDocument();
    expect(screen.getByText('max_items')).toBeInTheDocument();
  });

  it('renders boolean true as checkmark', () => {
    const flags = { enabled: true };
    render(<RemoteConfigPanel flags={flags} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders boolean false as X', () => {
    const flags = { disabled: false };
    render(<RemoteConfigPanel flags={flags} />);
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('renders nested categories', () => {
    const flags = {
      product_reviews: {
        enabled: true,
        count: 10,
      },
    };
    render(<RemoteConfigPanel flags={flags} />);
    expect(screen.getByText('product reviews')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
  });

  it('filters out _raw key', () => {
    const flags = {
      _raw: 'raw data',
      visible_flag: true,
    };
    render(<RemoteConfigPanel flags={flags} />);
    expect(screen.getByText('visible_flag')).toBeInTheDocument();
    expect(screen.queryByText('_raw')).not.toBeInTheDocument();
  });

  it('renders string values', () => {
    const flags = { locale: 'pt-BR' };
    // locale is an object type string, but it's rendered since it's not an object
    render(<RemoteConfigPanel flags={flags} />);
    expect(screen.getByText('pt-BR')).toBeInTheDocument();
  });
});
