import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CountryFlag } from '../ui/country-flag';
import { SelectField, TextField } from '../ui/form-field';
import { Modal, ModalCloseButton, ModalTitle } from '../ui/modal';
import { RingGauge } from '../ui/ring-gauge';
import { ToggleButton, ToggleGroup } from '../ui/toggle-group';
import { EmptyState } from '../empty-state';
import { SectionHeader } from '../ui/card';

describe('RingGauge', () => {
  it('é decorativo sem rótulo e desenha o arco proporcional', () => {
    const { container } = render(
      <RingGauge percent={50} size={100} strokeWidth={10} color="red">
        <span>50%</span>
      </RingGauge>,
    );
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    const arc = screen.getByTestId('ring-arc');
    const circumference = 2 * Math.PI * 40;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference / 2);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('expõe role img com rótulo e limita o percentual a 0–100', () => {
    render(<RingGauge percent={150} size={100} strokeWidth={10} color="red" label="Score" />);
    expect(screen.getByRole('img', { name: 'Score' })).toBeInTheDocument();
    expect(Number(screen.getByTestId('ring-arc').getAttribute('stroke-dashoffset'))).toBe(0);
  });

  it('não desenha o arco sem valor', () => {
    render(<RingGauge percent={null} size={100} strokeWidth={10} color="red" />);
    expect(screen.queryByTestId('ring-arc')).not.toBeInTheDocument();
  });
});

describe('ToggleGroup / ToggleButton', () => {
  it('sinaliza o botão ativo com aria-pressed e dispara onClick', async () => {
    const onClick = vi.fn();
    render(
      <ToggleGroup label="Filtro">
        <ToggleButton pressed onClick={vi.fn()}>
          A
        </ToggleButton>
        <ToggleButton pressed={false} onClick={onClick} size="sm" ariaLabel="Opção B">
          B
        </ToggleButton>
      </ToggleGroup>,
    );
    expect(screen.getByRole('group', { name: 'Filtro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true');
    const b = screen.getByRole('button', { name: 'Opção B' });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    expect(b).toHaveClass('text-xs');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TextField / SelectField', () => {
  it('associa label, marca obrigatório e expõe o erro', async () => {
    const onChange = vi.fn();
    render(
      <TextField
        id="nome"
        label="Nome"
        required
        value=""
        onChange={onChange}
        error="Obrigatório"
      />,
    );
    const input = screen.getByLabelText(/nome/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'nome-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Obrigatório');
    await userEvent.type(input, 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });

  it('mostra "(opcional)" e não marca inválido sem erro', () => {
    render(<TextField id="slug" label="Slug" optional value="" onChange={vi.fn()} />);
    expect(screen.getByText('(opcional)')).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).not.toHaveAttribute('aria-invalid');
  });

  it('lista as opções e devolve o valor escolhido', async () => {
    const onChange = vi.fn();
    render(
      <SelectField id="pais" label="País" value="BR" options={['BR', 'AR']} onChange={onChange} />,
    );
    await userEvent.selectOptions(screen.getByLabelText('País'), 'AR');
    expect(onChange).toHaveBeenCalledWith('AR');
  });
});

describe('Modal', () => {
  it('renderiza conteúdo quando aberto e fecha pelo botão', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} describedBy="desc">
        <ModalTitle>Título</ModalTitle>
        <p id="desc">Descrição</p>
        <ModalCloseButton />
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Título' })).toHaveAccessibleDescription('Descrição');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('não renderiza nada fechado', () => {
    render(
      <Modal open={false} onClose={vi.fn()} describedBy="desc">
        <ModalTitle>Título</ModalTitle>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CountryFlag', () => {
  it('usa a bandeira do flagcdn com dimensões explícitas', () => {
    render(<CountryFlag code="BR" width={20} height={15} alt="Brasil" />);
    const img = screen.getByRole('img', { name: 'Brasil' });
    expect(img.getAttribute('src')).toContain('flagcdn.com/20x15/br.png');
    expect(img).toHaveAttribute('width', '20');
  });
});

describe('EmptyState', () => {
  it('mostra título, badge e descrição', () => {
    render(
      <EmptyState
        icon={<span>i</span>}
        title="Sem dados"
        badge="Em breve"
        description="Volte depois"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Sem dados' })).toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getByText('Volte depois')).toBeInTheDocument();
  });

  it('omite badge e descrição quando ausentes', () => {
    render(<EmptyState icon={<span>i</span>} title="Sem dados" />);
    expect(screen.queryByText('Em breve')).not.toBeInTheDocument();
  });
});

describe('SectionHeader', () => {
  it('renderiza eyebrow, título com id, descrição e ação', () => {
    render(
      <SectionHeader
        id="sec"
        eyebrow="Escopo"
        title="Cobertura"
        description="Países"
        action={<button>Ação</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Cobertura' })).toHaveAttribute('id', 'sec');
    expect(screen.getByText('Escopo')).toBeInTheDocument();
    expect(screen.getByText('Países')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ação' })).toBeInTheDocument();
  });
});

describe('MotionProvider', () => {
  it('renderiza os filhos', async () => {
    const { MotionProvider } = await import('../motion-provider');
    render(
      <MotionProvider>
        <p>conteúdo</p>
      </MotionProvider>,
    );
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });
});
