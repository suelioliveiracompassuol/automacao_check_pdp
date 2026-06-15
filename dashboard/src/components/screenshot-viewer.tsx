"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";

interface ScreenshotViewerProps {
  screenshots: string[];
  runId: string;
}

export function ScreenshotViewer({ screenshots, runId }: ScreenshotViewerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (screenshots.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {screenshots.map((file) => (
          <button
            key={file}
            onClick={() => setSelected(file)}
            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            📷 {file.replace(/\.png$/, "").split("_").slice(-2, -1).join("")}
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
              <Dialog.Close className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
              {selected && (
                <img
                  src={`/data/reports/${runId}/screenshots/${selected}`}
                  alt={selected}
                  className="max-w-full max-h-full object-contain rounded shadow"
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
