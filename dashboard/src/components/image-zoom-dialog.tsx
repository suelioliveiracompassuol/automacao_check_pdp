'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Camera, ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;
const WHEEL_STEP = 0.2;
const PAN_STEP = 40;
/** Horizontal drag (px) that counts as a swipe to the next/previous image. */
const SWIPE_DISTANCE = 50;

export interface ZoomGallery {
  items: { src: string; title: string }[];
  index: number;
  onIndexChange: (index: number) => void;
}

interface ImageZoomDialogProps {
  /** Image URL; the dialog is open while this is non-null. */
  src: string | null;
  title: string;
  onClose: () => void;
  /** With more than one image, the dialog becomes a carousel over them (arrows, swipe, thumbnails). */
  gallery?: ZoomGallery;
}

const navClass =
  'absolute top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-high-emphasis shadow-lg transition-opacity hover:bg-surface cursor-pointer disabled:cursor-default disabled:opacity-30';

const clampZoom = (z: number) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

const controlClass =
  'rounded-lg p-2 text-medium-emphasis transition-colors hover:bg-neutral-100 hover:text-high-emphasis cursor-pointer';

/** Full-screen screenshot viewer with zoom and pan. Pan works with mouse, touch/pen (pointer
 * events) and the keyboard (arrow keys; +/- zoom, 0 resets) so dragging is never the only way.
 * With a `gallery`, unzoomed left/right arrows, a horizontal swipe, the side buttons or the
 * thumbnails move between its images. */
export function ImageZoomDialog({ src, title, onClose, gallery }: ImageZoomDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const swipeStart = useRef<number | null>(null);

  const isCarousel = gallery !== undefined && gallery.items.length > 1;
  const hasPrev = isCarousel && gallery.index > 0;
  const hasNext = isCarousel && gallery.index < gallery.items.length - 1;
  const goTo = (index: number) => {
    if (isCarousel && index >= 0 && index < gallery.items.length) {
      gallery.onIndexChange(index);
    }
  };

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (src !== null) {
      resetZoom();
    }
  }, [src, resetZoom]);

  const changeZoom = (delta: number) => {
    setZoom((z) => {
      const next = clampZoom(z + delta);
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    changeZoom(e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) {
      swipeStart.current = isCarousel ? e.clientX : null;
      // pointerup still arrives when the finger leaves the image
      if (isCarousel) {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) {
      return;
    }
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  };

  /** The browser took the gesture over (e.g. a scroll): its coordinates mean nothing, no swipe. */
  const cancelDrag = () => {
    setDragging(false);
    swipeStart.current = null;
  };

  const endDrag = (e: React.PointerEvent) => {
    setDragging(false);
    if (swipeStart.current !== null) {
      const dx = e.clientX - swipeStart.current;
      swipeStart.current = null;
      if (Math.abs(dx) >= SWIPE_DISTANCE) {
        goTo(gallery!.index + (dx < 0 ? 1 : -1));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const pan = (dx: number, dy: number) => {
      if (zoom <= 1) {
        // Unzoomed, left/right move through the carousel
        if (isCarousel && dx !== 0) {
          e.preventDefault();
          goTo(gallery.index + (dx > 0 ? -1 : 1));
        }
        return;
      }
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
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={handleKeyDown}
          className="dialog-content fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl bg-surface shadow-2xl md:inset-8 lg:inset-12"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-75 bg-neutral-50/80 px-4 py-2">
            <Dialog.Title className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-high-emphasis">
              <Camera className="h-4 w-4 shrink-0 text-primary-darkest" aria-hidden="true" />
              <span className="truncate">{title}</span>
              {isCarousel && (
                <span className="shrink-0 text-xs font-normal text-low-emphasis tabular-nums">
                  {gallery.index + 1} / {gallery.items.length}
                </span>
              )}
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
          <div className="relative flex min-h-0 flex-1">
            <div
              tabIndex={0}
              role="group"
              aria-label={
                isCarousel
                  ? 'Imagem ampliável. Use + e - para zoom, setas para mover (sem zoom: imagem anterior/próxima) e 0 para redefinir.'
                  : 'Imagem ampliável. Use + e - para zoom, setas para mover e 0 para redefinir.'
              }
              className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-50/50 p-4"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              style={{
                cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
                // Carousel: horizontal drags are swipes (vertical still scrolls the page)
                touchAction: zoom > 1 ? 'none' : isCarousel ? 'pan-y' : 'auto',
              }}
            >
              {src !== null && (
                // <img> nativo: o zoom/pan usa transform e tamanho intrínseco, que o next/image não ajuda.
                // eslint-disable-next-line @next/next/no-img-element
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
            {isCarousel && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(gallery.index - 1)}
                  disabled={!hasPrev}
                  className={cn(navClass, 'left-3')}
                  title="Imagem anterior"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(gallery.index + 1)}
                  disabled={!hasNext}
                  className={cn(navClass, 'right-3')}
                  title="Próxima imagem"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {isCarousel && (
            <ol
              aria-label="Imagens"
              className="flex shrink-0 justify-center gap-2 overflow-x-auto border-t border-neutral-75 bg-neutral-50/80 px-4 py-2"
            >
              {gallery.items.map((item, i) => (
                <li key={item.src} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={item.title}
                    aria-current={i === gallery.index ? 'true' : undefined}
                    title={item.title}
                    className={cn(
                      'block h-16 w-9 overflow-hidden rounded-md border-2 transition-opacity cursor-pointer',
                      i === gallery.index
                        ? 'border-primary opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-100',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
