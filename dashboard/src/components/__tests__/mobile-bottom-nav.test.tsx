import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from '../mobile-bottom-nav';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/') }));
vi.mock('next/navigation', () => ({ usePathname }));

describe('MobileBottomNav', () => {
  it('renders a link to every primary route', () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole('link', { name: /visão geral/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /^web$/i })).toHaveAttribute('href', '/web');
    expect(screen.getByRole('link', { name: /android/i })).toHaveAttribute('href', '/android');
    expect(screen.getByRole('link', { name: /ios/i })).toHaveAttribute('href', '/ios');
    expect(screen.getByRole('link', { name: /skus/i })).toHaveAttribute('href', '/skus');
  });

  it('marks the current route as active via aria-current', () => {
    usePathname.mockReturnValue('/android');
    render(<MobileBottomNav />);
    expect(screen.getByRole('link', { name: /android/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /visão geral/i })).not.toHaveAttribute('aria-current');
  });

  it('treats a run detail route as active for its platform tab', () => {
    usePathname.mockReturnValue('/android/run_android_123');
    render(<MobileBottomNav />);
    expect(screen.getByRole('link', { name: /android/i })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Web active when on the home route', () => {
    usePathname.mockReturnValue('/');
    render(<MobileBottomNav />);
    expect(screen.getByRole('link', { name: /^web$/i })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /visão geral/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
