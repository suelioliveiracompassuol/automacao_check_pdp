import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';

// next/link depende do router do App Router; nos testes basta um <a> simples.
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: PropsWithChildren<{ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
