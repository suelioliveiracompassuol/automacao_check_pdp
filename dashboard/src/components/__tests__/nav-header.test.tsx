import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NavHeader } from '../nav-header';

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
