import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SkuDeleteDialog } from '../sku-manager/sku-delete-dialog';

describe('SkuDeleteDialog', () => {
  it('não renderiza conteúdo quando skuName é null', () => {
    render(<SkuDeleteDialog skuName={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText('Excluir SKU')).not.toBeInTheDocument();
  });

  it('exibe o título e o nome do SKU quando aberto', () => {
    render(<SkuDeleteDialog skuName="Creme Hidratante" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Excluir SKU')).toBeInTheDocument();
    expect(screen.getByText('Creme Hidratante')).toBeInTheDocument();
  });

  it('chama onConfirm ao clicar em Excluir', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SkuDeleteDialog skuName="Produto A" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^excluir$/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('chama onCancel ao clicar em Cancelar', async () => {
    const onCancel = vi.fn();
    render(
      <SkuDeleteDialog
        skuName="Produto A"
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
