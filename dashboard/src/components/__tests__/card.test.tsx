import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, Badge } from '../../components/ui/card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="extra">Content</Card>);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('has default styling classes', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('bg-white', 'rounded-xl');
  });
});

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Badge text</Badge>);
    expect(screen.getByText('Badge text')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom">Text</Badge>);
    expect(container.firstChild).toHaveClass('custom');
  });

  it('has default styling classes', () => {
    const { container } = render(<Badge>Text</Badge>);
    expect(container.firstChild).toHaveClass('inline-flex', 'rounded-md');
  });
});
