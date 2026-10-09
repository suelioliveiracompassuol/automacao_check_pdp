'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Camera, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;
const WHEEL_STEP = 0.2;
const PAN_STEP = 40;

interface ImageZoomDialogProps {
  /** Image URL; the dialog is open while this is non-null. */
  src: string | null;
  title: string;
  onClose: () => void;
}

const clampZoom = (z: number) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

const controlClass =
  'rounded-lg p-2 text-medium-emphasis transition-colors hover:bg-neutral-100 hover:text-high-emphasis cursor-pointer';

/** Full-screen screenshot viewer with zoom and pan. Pan works with mouse, touch/pen (pointer
 * events) and the keyboard (arrow keys; +/- zoom, 0 resets) so dragging is never the only way. */
export function ImageZoomDialog({ src, title, onClose }: ImageZoomDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (src !== null) resetZoom();
  }, [src, resetZoom]);

  const changeZoom = (delta: number) => {
    setZoom((z) => {
      const next = clampZoom(z + delta);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    changeZoom(e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  };

  const endDrag = () => setDragging(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const pan = (dx: number, dy: number) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
    };
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        changeZoom(ZOOM_STEP);
        break;
      case '-':
        e.preventDefault();
        changeZoom(-ZOOM_STEP);
        break;
      case '0':
        e.preventDefault();
        resetZoom();
        break;
      case 'ArrowLeft':
        pan(PAN_STEP, 0);
        break;
      case 'ArrowRight':
        pan(-PAN_STEP, 0);
        break;
      case 'ArrowUp':
        pan(0, PAN_STEP);
        break;
      case 'ArrowDown':
        pan(0, -PAN_STEP);
        break;
    }
  };

  return (
    <Dialog.Root
      open={src !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="dialog-content fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl bg-surface shadow-2xl md:inset-8 lg:inset-12"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-75 bg-neutral-50/80 px-4 py-2">
            <Dialog.Title className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-high-emphasis">
              <Camera className="h-4 w-4 shrink-0 text-primary-darkest" aria-hidden="true" />
              <span className="truncate">{title}</span>
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => changeZoom(-ZOOM_STEP)}
                className={controlClass}
                title="Diminuir zoom"
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                className="w-12 text-center text-xs text-medium-emphasis tabular-nums"
                aria-live="polite"
              >
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => changeZoom(ZOOM_STEP)}
                className={controlClass}
                title="Aumentar zoom"
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                className={controlClass}
                title="Redefinir zoom"
                aria-label="Redefinir zoom"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <Dialog.Close className={`${controlClass} ml-2`} aria-label="Fechar" title="Fechar">
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>
          <div
            tabIndex={0}
            role="group"
            aria-label="Imagem ampliável. Use + e - para zoom, setas para mover e 0 para redefinir."
            className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-50/50 p-4"
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
              touchAction: zoom > 1 ? 'none' : 'auto',
            }}
          >
            {src !== null && (
              <img
                src={src}
                alt={title}
                className="max-h-full max-w-full rounded-lg border border-neutral-100 object-contain shadow-lg select-none"
                draggable={false}
                style={{
                  transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transition: dragging ? 'none' : 'transform 0.2s ease',
                }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
