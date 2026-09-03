import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SkuCard } from '../sku-manager/sku-card';
import type { SkuEntry } from '@/lib/types';

const entry: SkuEntry = {
  id: 'NATBRA-70983',
  sku: 'NATBRA-70983',
  name: 'Creme Hidratante Ekos Castanha',
  vendor: 'natura',
  country: 'BR',
  channel: 'ecommerce',
  expectedFeatures: [],
};

describe('SkuCard', () => {
  it('renderiza nome, id, vendor, país e canal', () => {
    render(<SkuCard entry={entry} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Creme Hidratante Ekos Castanha')).toBeInTheDocument();
    expect(screen.getByText('NATBRA-70983')).toBeInTheDocument();
    expect(screen.getByText('natura')).toBeInTheDocument();
    expect(screen.getByText('BR')).toBeInTheDocument();
    expect(screen.getByText('E-com')).toBeInTheDocument();
  });

  it('chama onEdit com a entrada completa ao clicar em editar', async () => {
    const onEdit = vi.fn();
    render(<SkuCard entry={entry} onEdit={onEdit} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(`Editar ${entry.name}`));
    expect(onEdit).toHaveBeenCalledWith(entry);
  });

  it('chama onDelete com o id ao clicar em excluir', async () => {
    const onDelete = vi.fn();
    render(<SkuCard entry={entry} onEdit={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByLabelText(`Excluir ${entry.name}`));
    expect(onDelete).toHaveBeenCalledWith('NATBRA-70983');
  });

  it('aplica estilo rose para vendor avon', () => {
    render(<SkuCard entry={{ ...entry, vendor: 'avon' }} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('avon').className).toContain('rose');
  });

  it('aplica estilo purple para canal socialcommerce', () => {
    render(
      <SkuCard
        entry={{ ...entry, channel: 'socialcommerce' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Social').className).toContain('purple');
  });
});
