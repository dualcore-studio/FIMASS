import type { LucideIcon } from 'lucide-react';

interface DashboardPrimaryKpiProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
}

export default function DashboardPrimaryKpi({ label, value, icon: Icon }: DashboardPrimaryKpiProps) {
  return (
    <div className="dashboard-primary-kpi group relative overflow-hidden rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.06)] sm:px-5 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-[2rem] sm:leading-none">
            {value}
          </p>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-400 transition-colors group-hover:border-slate-200 group-hover:text-slate-500"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}
