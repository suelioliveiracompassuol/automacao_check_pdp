"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { basePath } from "@/lib/config";

interface ScreenshotViewerProps {
  screenshots: string[];
  runId: string;
}

export function ScreenshotViewer({
  screenshots,
  runId,
}: ScreenshotViewerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleOpen = (file: string) => {
    setSelected(file);
    resetZoom();
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 5));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.5, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom((z) => {
      const next = Math.min(Math.max(z + delta, 0.5), 5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  if (screenshots.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {screenshots.map((file) => (
          <button
            key={file}
            onClick={() => handleOpen(file)}
            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            📷{" "}
            {file
              .replace(/\.png$/, "")
              .split("_")
              .slice(-2, -1)
              .join("")}
          </button>
        ))}
      </div>

      <Dialog.Root open={!!selected} onOpenChange={() => setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed inset-4 md:inset-12 z-50 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Dialog.Title className="text-sm font-medium text-gray-700 truncate">
                {selected}
              </Dialog.Title>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-600 cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-600 cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-600 cursor-pointer"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <Dialog.Close className="p-1 rounded hover:bg-gray-100 cursor-pointer ml-2">
                  <X className="w-5 h-5" />
                </Dialog.Close>
              </div>
            </div>
            <div
              className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-gray-50"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
              }}
            >
              {selected && (
                <img
                  src={`${basePath}/reports/${runId}/screenshots/${selected}`}
                  alt={selected}
                  className="max-w-full max-h-full object-contain rounded shadow select-none"
                  draggable={false}
                  style={{
                    transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                    transition: dragging ? "none" : "transform 0.2s ease",
                  }}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
