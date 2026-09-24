'use client';

import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Printer, ChevronUp, ChevronDown } from 'lucide-react';

interface PresentationSection {
  id: string;
  label: string;
}

interface PresentationControlsProps {
  sections: PresentationSection[];
}

/**
 * Floating controls for the /visao-geral page: fullscreen "presentation mode"
 * (hides the app nav header via a body class, see globals.css), keyboard/dot
 * navigation between sections, and print-to-PDF.
 */
export function PresentationControls({ sections }: PresentationControlsProps) {
  const [isPresenting, setIsPresenting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    document.body.classList.toggle('presentation-mode', isPresenting);
    return () => document.body.classList.remove('presentation-mode');
  }, [isPresenting]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const goToSection = (index: number) => {
    const clamped = Math.max(0, Math.min(sections.length - 1, index));
    setActiveIndex(clamped);
    document.getElementById(sections[clamped].id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToSection(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToSection(activeIndex - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setIsPresenting(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsPresenting(false);
    }
  };

  return (
    <div className="no-print fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      <div className="flex items-center gap-1 rounded-full border border-neutral-100 bg-white/95 p-1.5 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => goToSection(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Seção anterior"
          className="rounded-full p-1.5 text-medium-emphasis hover:bg-neutral-75 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span className="w-14 text-center text-[10px] font-medium text-medium-emphasis">
          {activeIndex + 1}/{sections.length}
        </span>
        <button
          type="button"
          onClick={() => goToSection(activeIndex + 1)}
          disabled={activeIndex === sections.length - 1}
          aria-label="Próxima seção"
          className="rounded-full p-1.5 text-medium-emphasis hover:bg-neutral-75 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-neutral-100" />
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Imprimir / exportar PDF"
          className="rounded-full p-1.5 text-medium-emphasis hover:bg-neutral-75"
        >
          <Printer className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isPresenting ? 'Sair do modo apresentação' : 'Modo apresentação'}
          className="rounded-full p-1.5 text-primary-dark hover:bg-primary-wash"
        >
          {isPresenting ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
