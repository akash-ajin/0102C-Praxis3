import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  right,
  children
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-900/5">
      {(title || subtitle || right) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && (
              <div className="truncate text-base font-semibold">{title}</div>
            )}
            {subtitle && (
              <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
            )}
          </div>
          {right}
        </div>
      )}
      {children && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

