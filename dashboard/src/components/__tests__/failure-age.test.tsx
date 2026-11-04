import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FailureAge } from '../feature-table';
import type { CheckResult } from '@/lib/types';

const failing = (over: Partial<CheckResult>): CheckResult => ({
  feature: 'Avaliações',
  featureKey: 'reviews',
  passed: false,
  status: 'fail',
  message: 'Seção não encontrada',
  ...over,
});

describe('FailureAge', () => {
  it('mostra "Nova" quando a falha não acontecia no run anterior', () => {
    render(<FailureAge feature={failing({ newFailure: true })} />);
    expect(screen.getByText('Nova')).toBeInTheDocument();
  });

  it('mostra desde quando a falha persiste', () => {
    render(
      <FailureAge feature={failing({ newFailure: false, failingSince: '2026-11-02T12:00:00Z' })} />,
    );
    expect(screen.getByText(/desde\s+02\/11/)).toBeInTheDocument();
  });

  it('não mostra nada sem histórico (relatórios antigos) ou com data inválida', () => {
    const { container, rerender } = render(<FailureAge feature={failing({})} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<FailureAge feature={failing({ newFailure: false, failingSince: 'x' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
