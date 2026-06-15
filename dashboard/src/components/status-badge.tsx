import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";
import { getStatusIcon } from "@/lib/utils";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        className,
      )}
    >
      <span>{getStatusIcon(status)}</span>
    </span>
  );
}
