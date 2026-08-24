import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SkuForm } from '../sku-manager/sku-form';
import type { SkuEntry } from '@/lib/types';

const entry: SkuEntry = {
  id: 'NATBRA-70983',
  sku: 'NATBRA-70983',
  name: 'Creme Hidratante',
  slug: 'creme-hidratante',
  vendor: 'natura',
  country: 'BR',
  channel: 'ecommerce',
  expectedFeatures: ['reviews'],
};

describe('SkuForm', () => {
  it('exibe título "Novo SKU" ao criar', () => {
    render(<SkuForm open initialData={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Novo SKU')).toBeInTheDocument();
  });

  it('exibe título "Editar SKU" ao editar', () => {
    render(<SkuForm open initialData={entry} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Editar SKU')).toBeInTheDocument();
  });

  it('pré-preenche sku e nome com initialData', () => {
    render(<SkuForm open initialData={entry} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('NATBRA-70983')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Creme Hidratante')).toBeInTheDocument();
  });

  it('exibe erro de validação quando SKU está vazio', async () => {
    render(<SkuForm open initialData={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^nome/i), 'Produto');
    await userEvent.click(screen.getByRole('button', { name: /criar sku/i }));
    expect(await screen.findByText('SKU é obrigatório')).toBeInTheDocument();
  });

  it('exibe erro de validação quando Nome está vazio', async () => {
    render(<SkuForm open initialData={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^sku/i), 'NATBRA-123');
    await userEvent.click(screen.getByRole('button', { name: /criar sku/i }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
  });

  it('chama onSubmit com payload correto quando o formulário é válido', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SkuForm open initialData={null} onSubmit={onSubmit} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^sku/i), 'NATBRA-123');
    await userEvent.type(screen.getByLabelText(/^nome/i), 'Produto Teste');
    await userEvent.click(screen.getByRole('button', { name: /criar sku/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'NATBRA-123',
          name: 'Produto Teste',
          vendor: 'natura',
          country: 'BR',
          channel: 'ecommerce',
        }),
      ),
    );
  });

  it('chama onClose ao clicar em Cancelar', async () => {
    const onClose = vi.fn();
    render(<SkuForm open initialData={null} onSubmit={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('pré-marca as features do initialData', () => {
    render(<SkuForm open initialData={entry} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'reviews' })).toBeChecked();
  });

  it('desmarca a feature ao clicar novamente', async () => {
    render(<SkuForm open initialData={entry} onSubmit={vi.fn()} onClose={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox', { name: 'reviews' });
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
