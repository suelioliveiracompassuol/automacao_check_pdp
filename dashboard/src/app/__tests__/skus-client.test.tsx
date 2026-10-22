import { render, screen, waitFor, within } from '@testing-library/react';
import userEventLib from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSku } from '@/test/fixtures';

const api = vi.hoisted(() => ({
  readSkus: vi.fn(),
  createSku: vi.fn(),
  updateSku: vi.fn(),
  deleteSku: vi.fn(),
}));
vi.mock('@/lib/sku-data-client', () => api);

const auth = vi.hoisted(() => ({ user: null as { email: string } | null, loading: false }));
vi.mock('@/components/auth-context', () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth-login', () => ({ AuthLogin: () => <div>login</div> }));

import SkusPage from '../skus/page';
import { SkusClient } from '../skus/skus-client';

// Sem atraso entre teclas: os fluxos de formulário digitam bastante e estouravam o timeout.
const userEvent = userEventLib.setup({ delay: null });

const existing = makeSku({ id: 'NATBRA-1', sku: 'NATBRA-1', name: 'Creme' });

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { email: 'a@b.com' };
  auth.loading = false;
  api.readSkus.mockResolvedValue([existing]);
});

describe('SkusClient', () => {
  it('carrega e lista os SKUs', async () => {
    render(<SkusClient />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando SKUs…');
    expect(await screen.findByText('Creme')).toBeInTheDocument();
  });

  it('mostra erro quando a carga falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.readSkus.mockRejectedValue(new Error('offline'));
    render(<SkusClient />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
  });

  it('bloqueia ações e mostra aviso sem login', async () => {
    auth.user = null;
    render(<SkusClient />);
    expect(await screen.findByText('Acesso Restrito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /novo sku/i })).toBeDisabled();
  });

  it('cria um SKU', async () => {
    api.createSku.mockImplementation(async (data) => ({ id: data.sku, ...data }));
    render(<SkusClient />);
    await userEvent.click(await screen.findByRole('button', { name: /novo sku/i }));
    const dialog = screen.getByRole('dialog', { name: 'Novo SKU' });
    await userEvent.type(within(dialog).getByLabelText(/^sku/i), 'NATBRA-2');
    await userEvent.type(within(dialog).getByLabelText(/^nome/i), 'Perfume');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar SKU' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Perfume')).toBeInTheDocument();
    expect(api.createSku).toHaveBeenCalledWith(expect.objectContaining({ sku: 'NATBRA-2' }));
  });

  it('edita um SKU e substitui o card mesmo quando o id muda', async () => {
    api.updateSku.mockImplementation(async (_id, data) => ({ id: `${data.sku}:sc`, ...data }));
    render(<SkusClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Creme' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar SKU' });
    const name = within(dialog).getByLabelText(/^nome/i);
    await userEvent.clear(name);
    await userEvent.type(name, 'Creme Novo');
    await userEvent.selectOptions(within(dialog).getByLabelText('Canal'), 'socialcommerce');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.updateSku).toHaveBeenCalledWith('NATBRA-1', expect.any(Object));
    expect(screen.getByText('Creme Novo')).toBeInTheDocument();
    expect(screen.queryByText('Creme')).not.toBeInTheDocument();
  });

  it('mantém o formulário aberto com erro quando o SKU sumiu', async () => {
    api.updateSku.mockResolvedValue(null);
    render(<SkusClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Creme' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('SKU não encontrado')).toBeInTheDocument();
  });

  it('exclui um SKU após confirmação', async () => {
    api.deleteSku.mockResolvedValue(true);
    render(<SkusClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Creme' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir SKU' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(screen.queryByText('Creme')).not.toBeInTheDocument());
    expect(api.deleteSku).toHaveBeenCalledWith('NATBRA-1');
  });

  it('cancela a exclusão', async () => {
    render(<SkusClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Creme' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deleteSku).not.toHaveBeenCalled();
  });
});

describe('SkusPage', () => {
  it('renderiza login e gerenciador sem um <main> aninhado', async () => {
    const { container } = render(<SkusPage />);
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(await screen.findByText('Creme')).toBeInTheDocument();
    expect(container.querySelector('main')).toBeNull();
  });
});
