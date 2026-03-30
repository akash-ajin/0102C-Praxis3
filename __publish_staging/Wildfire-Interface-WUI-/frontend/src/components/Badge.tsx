import type { ReactNode } from "react";
import type { AlertSeverity } from "../lib/types";

const styles: Record<
  AlertSeverity | "unknown",
  { label: string; className: string }
> = {
  critical: {
    label: "CRITICAL",
    className: "bg-red-600 text-white"
  },
  advisory: {
    label: "ADVISORY",
    className: "bg-yellow-400 text-slate-900"
  },
  test: {
    label: "TEST",
    className: "bg-emerald-500 text-white"
  },
  unknown: {
    label: "UNKNOWN",
    className: "bg-slate-200 text-slate-900"
  }
};

export function Badge({
  severity,
  rightSlot
}: {
  severity: AlertSeverity | "unknown";
  rightSlot?: ReactNode;
}) {
  const s = styles[severity];
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
          s.className
        ].join(" ")}
      >
        {s.label}
      </span>
      {rightSlot}
    </div>
  );
}

