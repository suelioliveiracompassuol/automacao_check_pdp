import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CatalogQualityPanel, QUALITY_PAGE_SIZE } from '../catalog/catalog-quality-panel';
import { makeCatalogIssue, makeCatalogQualityReport } from '@/test/fixtures';

const rows = () => screen.getAllByRole('row').slice(1);

describe('CatalogQualityPanel', () => {
  it('mostra o resumo e só os problemas de produtos disponíveis', () => {
    render(<CatalogQualityPanel report={makeCatalogQualityReport()} />);
    const summary = within(screen.getByRole('region', { name: 'Resumo da validação' }));
    expect(summary.getByText('Erros').nextSibling).toHaveTextContent('1');
    expect(summary.getByText('Alertas').nextSibling).toHaveTextContent('1');
    expect(rows()).toHaveLength(2);
    expect(screen.getByText('"licha" (seria "lichia"?)')).toBeInTheDocument();
  });

  it('inclui indisponíveis ao trocar para o catálogo todo', () => {
    render(<CatalogQualityPanel report={makeCatalogQualityReport()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Catálogo todo' }));
    expect(rows()).toHaveLength(3);
    expect(screen.getByText('indisponível')).toBeInTheDocument();
  });

  it('clicar numa regra filtra a lista e "mostrar todas" desfaz', () => {
    render(<CatalogQualityPanel report={makeCatalogQualityReport()} />);
    const card = screen.getByRole('button', { name: /Nota com possível erro de digitação/ });
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todas as regras' }));
    expect(rows()).toHaveLength(2);
  });

  it('regra sem problema fica desabilitada', () => {
    render(<CatalogQualityPanel report={makeCatalogQualityReport()} />);
    expect(screen.getByRole('button', { name: /Link da PDP/ })).toBeDisabled();
  });

  it('filtra por severidade e busca, e avisa quando não sobra nada', () => {
    render(<CatalogQualityPanel report={makeCatalogQualityReport()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Erros' }));
    expect(rows()).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText('SKU, nome ou texto do problema'), {
      target: { value: 'nada disso' },
    });
    expect(screen.getByText('Nenhum problema com esses filtros.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(rows()).toHaveLength(1);
  });

  it('exporta os problemas filtrados em CSV', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<CatalogQualityPanel report={makeCatalogQualityReport()} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });

  it('pagina a lista', () => {
    const issues = Array.from({ length: QUALITY_PAGE_SIZE + 5 }, (_, i) =>
      makeCatalogIssue({ sku: `NATBRA-${i}` }),
    );
    render(<CatalogQualityPanel report={makeCatalogQualityReport({ issues })} />);
    expect(rows()).toHaveLength(QUALITY_PAGE_SIZE);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (5 restantes)' }));
    expect(rows()).toHaveLength(QUALITY_PAGE_SIZE + 5);
  });
});
