import Link from "next/link";
import { Activity } from "lucide-react";
import { getReportIndex } from "@/lib/data";
import { HistoryDropdown } from "./history-dropdown";

export function NavHeader() {
  const index = getReportIndex();
  const runs = index.reports.slice(0, 15);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-lg">PDP Monitor</span>
        </Link>
        <HistoryDropdown runs={runs} />
      </div>
    </header>
  );
}
