import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthProvider } from '../auth-context';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase-init', () => ({
  firebaseApp: {},
}));

describe('AuthProvider', () => {
  it('deve renderizar sem erros', () => {
    const { container } = render(
      <AuthProvider>
        <div>Conteúdo</div>
      </AuthProvider>,
    );
    expect(container.querySelector('div')).toBeDefined();
  });
});
