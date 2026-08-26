"use client";

import type { CheckResult } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { basePath } from "@/lib/config";
import {
  Camera,
  X,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, useRef, useCallback } from "react";

interface FeatureTableProps {
  features: CheckResult[];
  runId: string;
  pageScreenshot?: string;
}

export function FeatureTable({
  features,
  runId,
  pageScreenshot,
}: FeatureTableProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const openScreenshot = (src: string, title: string) => {
    setSelectedScreenshot({ src, title });
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

  if (features.length === 0) {
    return null;
  }

  // Only count features that are actually testable (exclude na)
  const testable = features.filter((f) => f.status !== "na");
  const passed = testable.filter(
    (f) => f.passed || f.status === "disabled",
  ).length;
  const failed = testable.filter(
    (f) => !f.passed && f.status !== "disabled",
  ).length;
  const total = testable.length;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  const getScreenshotUrl = (path: string) =>
    `${basePath}/reports/${runId}/${path}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {passed}/{total} verificações
        </span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              failed > 0
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                : "bg-gradient-to-r from-emerald-400 to-emerald-500",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span
          className={cn(
            "text-xs font-bold whitespace-nowrap",
            failed > 0 ? "text-red-600" : "text-emerald-600",
          )}
        >
          {percentage}%
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 text-left">
              <th className="py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide w-24">
                Status
              </th>
              <th className="py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Feature
              </th>
              <th className="py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr
                key={`${f.featureKey}-${i}`}
                className={cn(
                  "border-t border-gray-50 transition-colors",
                  f.status === "fail" && "bg-red-50/60 hover:bg-red-50",
                  f.status === "pass" && "hover:bg-gray-50/80",
                  f.status === "warning" &&
                  "bg-amber-50/40 hover:bg-amber-50/60",
                  f.status === "error" && "bg-amber-50/40 hover:bg-amber-50/60",
                  f.status === "na" && "opacity-60 hover:opacity-80",
                  f.status === "disabled" && "opacity-50",
                )}
              >
                <td className="py-2 px-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="py-2 px-3 font-medium text-gray-800 text-xs">
                  {f.feature}
                </td>
                <td className="py-2 px-3 text-gray-600 max-w-md text-xs leading-relaxed">
                  {f.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Page screenshot link */}
      {pageScreenshot && (
        <button
          onClick={() =>
            openScreenshot(
              getScreenshotUrl(pageScreenshot),
              "Screenshot da página completa",
            )
          }
          className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors cursor-pointer mt-2"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Ver screenshot da página completa
        </button>
      )}

      {/* Screenshot Modal */}
      <Dialog.Root
        open={!!selectedScreenshot}
        onOpenChange={() => setSelectedScreenshot(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed inset-4 md:inset-8 lg:inset-12 z-50 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
              <Dialog.Title className="text-sm font-semibold text-gray-700 truncate flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                {selectedScreenshot?.title}
              </Dialog.Title>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <Dialog.Close className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer ml-2">
                  <X className="w-5 h-5 text-gray-500" />
                </Dialog.Close>
              </div>
            </div>
            <div
              className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-gray-50/50"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
              }}
            >
              {selectedScreenshot && (
                <img
                  src={selectedScreenshot.src}
                  alt={selectedScreenshot.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-gray-200 select-none"
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
    </div>
  );
}
