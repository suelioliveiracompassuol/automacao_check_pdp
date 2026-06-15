import type { CheckResult } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { cn, getStatusColor } from "@/lib/utils";

const columns = [
  { key: "status", label: "Status" },
  { key: "feature", label: "Feature" },
  { key: "message", label: "Mensagem" },
];
const headColumnClasses = "py-2 px-3 font-semibold text-gray-600";
interface FeatureTableProps {
  features: CheckResult[];
}

export function FeatureTable({ features }: FeatureTableProps) {
  if (features.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            {columns.map((col) => (
              <th key={col.key} className={headColumnClasses}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr
              key={`${f.featureKey}-${i}`}
              className={cn(
                "border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                getStatusColor(f.status),
              )}
            >
              <td className="py-2 px-3">
                <StatusBadge status={f.status} />
              </td>
              <td className="py-2 px-3 font-medium text-gray-800">
                {f.feature}
              </td>
              <td className="py-2 px-3 text-gray-600 max-w-md">{f.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
