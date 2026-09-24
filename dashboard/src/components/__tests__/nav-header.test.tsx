import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NavHeader } from '../nav-header';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe('NavHeader', () => {
  it('renders the title', () => {
    render(<NavHeader />);
    expect(screen.getByText('PDP Monitor')).toBeInTheDocument();
  });

  it('renders link to home', () => {
    render(<NavHeader />);
    const link = screen.getByRole('link', { name: /PDP Monitor/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
