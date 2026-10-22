import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

// Config própria do dashboard: sem ela o ESLint sobe até o eslint.config.mjs da raiz (do
// monitor), que não tem as regras de React/Next.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettier,
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'coverage/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
