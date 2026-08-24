import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SkuList } from '../sku-manager/sku-list';
import type { SkuEntry } from '@/lib/types';

const skus: SkuEntry[] = [
  {
    id: 'NATBRA-1',
    sku: 'NATBRA-1',
    name: 'Produto Natura BR',
    vendor: 'natura',
    country: 'BR',
    channel: 'ecommerce',
    expectedFeatures: [],
  },
  {
    id: 'AVNBRA-1',
    sku: 'AVNBRA-1',
    name: 'Produto Avon BR',
    vendor: 'avon',
    country: 'BR',
    channel: 'ecommerce',
    expectedFeatures: [],
  },
  {
    id: 'NATARG-1',
    sku: 'NATARG-1',
    name: 'Produto Natura AR',
    vendor: 'natura',
    country: 'AR',
    channel: 'ecommerce',
    expectedFeatures: [],
  },
];

describe('SkuList', () => {
  it('renderiza todos os SKUs sem filtro', () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Produto Natura BR')).toBeInTheDocument();
    expect(screen.getByText('Produto Avon BR')).toBeInTheDocument();
    expect(screen.getByText('Produto Natura AR')).toBeInTheDocument();
  });

  it('filtra por texto no nome', async () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/buscar por nome/i), 'Avon');
    expect(screen.getByText('Produto Avon BR')).toBeInTheDocument();
    expect(screen.queryByText('Produto Natura BR')).not.toBeInTheDocument();
  });

  it('filtra por código SKU', async () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/buscar por nome/i), 'NATARG');
    expect(screen.getByText('Produto Natura AR')).toBeInTheDocument();
    expect(screen.queryByText('Produto Natura BR')).not.toBeInTheDocument();
  });

  it('filtra por vendor', async () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por vendor'), 'avon');
    expect(screen.getByText('Produto Avon BR')).toBeInTheDocument();
    expect(screen.queryByText('Produto Natura BR')).not.toBeInTheDocument();
  });

  it('filtra por país', async () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por país'), 'AR');
    expect(screen.getByText('Produto Natura AR')).toBeInTheDocument();
    expect(screen.queryByText('Produto Natura BR')).not.toBeInTheDocument();
  });

  it('exibe estado vazio quando nenhum SKU bate com o filtro', async () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/buscar por nome/i), 'inexistente-xyz-999');
    expect(screen.getByText('Nenhum SKU encontrado')).toBeInTheDocument();
  });

  it('agrupa SKUs nas seções corretas de operação', () => {
    render(<SkuList skus={skus} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Natura Brasil')).toBeInTheDocument();
    expect(screen.getByText('Avon Brasil')).toBeInTheDocument();
    expect(screen.getByText('Natura Argentina')).toBeInTheDocument();
  });
});
