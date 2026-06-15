"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

interface RemoteConfigPanelProps {
  flags: Record<string, unknown> | undefined;
  locale?: string;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === true) {
    return <span className="text-emerald-600 font-bold">✓</span>;
  }
  if (value === false) {
    return <span className="text-red-500 font-bold">✗</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }
  if (typeof value === "object") {
    return null;
  } // skip nested
  return <span className="text-gray-700">{String(value)}</span>;
}

export function RemoteConfigPanel({ flags }: RemoteConfigPanelProps) {
  const [open, setOpen] = useState(false);

  if (!flags) {
    return null;
  }

  // Filter out _raw and nested objects for display
  const entries = Object.entries(flags).filter(
    ([key, val]) => key !== "_raw" && typeof val !== "object",
  );
  const nested = Object.entries(flags).filter(
    ([key, val]) => key !== "_raw" && typeof val === "object" && val !== null,
  );

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      {/* <Collapsible.Trigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700 cursor-pointer">
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        🔧 Remote Config {locale && <span className="text-gray-400 font-normal text-xs">({locale})</span>}
        <span className="text-gray-400 font-normal text-xs ml-auto">
          {entries.length + nested.length} flags
        </span>
      </Collapsible.Trigger> */}

      <Collapsible.Content className="mt-2 space-y-2">
        {entries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 px-3">
            {entries.map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 px-2 py-1 bg-gray-50 rounded text-xs"
              >
                <code className="text-gray-600 truncate">{key}</code>
                {renderValue(val)}
              </div>
            ))}
          </div>
        )}

        {nested.map(([category, obj]) => (
          <div key={category} className="px-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1 capitalize">
              {category.replace(/_/g, " ")}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
              {Object.entries(obj as Record<string, unknown>)
                .filter(([, v]) => typeof v !== "object")
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-2 px-2 py-1 bg-white border border-gray-100 rounded text-xs"
                  >
                    <code className="text-gray-600 truncate">{k}</code>
                    {renderValue(v)}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
