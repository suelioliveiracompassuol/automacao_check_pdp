import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ImageZoomDialog } from '../image-zoom-dialog';

beforeAll(() => {
  // jsdom não implementa pointer capture.
  Element.prototype.setPointerCapture ??= vi.fn();
});

const renderDialog = (onClose = vi.fn()) => {
  render(<ImageZoomDialog src="/shot.png" title="Screenshot" onClose={onClose} />);
  return {
    onClose,
    zoomLabel: () => screen.getByText(/^\d+%$/),
    stage: () => screen.getByRole('group', { name: /imagem ampliável/i }),
    image: () => screen.getByRole('img', { name: 'Screenshot' }),
  };
};

describe('ImageZoomDialog', () => {
  it('não abre sem imagem', () => {
    render(<ImageZoomDialog src={null} title="x" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aumenta, diminui e redefine o zoom pelos botões', async () => {
    const { zoomLabel } = renderDialog();
    expect(screen.getByRole('dialog', { name: 'Screenshot' })).toBeInTheDocument();
    expect(zoomLabel()).toHaveTextContent('100%');
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    expect(zoomLabel()).toHaveTextContent('150%');
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir zoom' }));
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir zoom' }));
    expect(zoomLabel()).toHaveTextContent('50%');
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir zoom' }));
    expect(zoomLabel()).toHaveTextContent('50%'); // mínimo
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir zoom' }));
    expect(zoomLabel()).toHaveTextContent('100%');
  });

  it('aceita atalhos de teclado para zoom e movimento', () => {
    const { zoomLabel, stage, image } = renderDialog();
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' }); // sem zoom não move
    expect(image().style.transform).toContain('translate(0px, 0px)');
    fireEvent.keyDown(stage(), { key: '+' });
    fireEvent.keyDown(stage(), { key: '=' });
    expect(zoomLabel()).toHaveTextContent('200%');
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' });
    fireEvent.keyDown(stage(), { key: 'ArrowUp' });
    expect(image().style.transform).toBe('scale(2) translate(20px, 20px)');
    fireEvent.keyDown(stage(), { key: 'ArrowRight' });
    fireEvent.keyDown(stage(), { key: 'ArrowDown' });
    expect(image().style.transform).toBe('scale(2) translate(0px, 0px)');
    fireEvent.keyDown(stage(), { key: '-' });
    expect(zoomLabel()).toHaveTextContent('150%');
    fireEvent.keyDown(stage(), { key: '0' });
    expect(zoomLabel()).toHaveTextContent('100%');
  });

  it('dá zoom com a roda do mouse', () => {
    const { zoomLabel, stage } = renderDialog();
    fireEvent.wheel(stage(), { deltaY: -100 });
    expect(zoomLabel()).toHaveTextContent('120%');
    fireEvent.wheel(stage(), { deltaY: 100 });
    expect(zoomLabel()).toHaveTextContent('100%');
  });

  it('arrasta a imagem quando ampliada', () => {
    const { stage, image } = renderDialog();
    fireEvent.pointerDown(stage(), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(stage(), { clientX: 50, clientY: 50 });
    expect(image().style.transform).toContain('translate(0px, 0px)'); // sem zoom não arrasta

    fireEvent.keyDown(stage(), { key: '+' });
    fireEvent.pointerDown(stage(), { clientX: 10, clientY: 10, pointerId: 1 });
    expect(stage().style.cursor).toBe('grabbing');
    fireEvent.pointerMove(stage(), { clientX: 40, clientY: 25 });
    expect(image().style.transform).toBe('scale(1.5) translate(20px, 10px)');
    fireEvent.pointerUp(stage());
    expect(stage().style.cursor).toBe('grab');
  });

  it('fecha pelo botão Fechar', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
