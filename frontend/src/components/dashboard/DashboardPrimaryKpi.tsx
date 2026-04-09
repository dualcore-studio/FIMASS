import type { LucideIcon } from 'lucide-react';

interface DashboardPrimaryKpiProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Evidenzia la card (es. solleciti da leggere). */
  variant?: 'default' | 'attention';
}

export default function DashboardPrimaryKpi({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: DashboardPrimaryKpiProps) {
  const isAttention = variant === 'attention';

  return (
    <div
      className={`dashboard-primary-kpi group relative overflow-hidden rounded-xl px-4 py-4 sm:px-5 sm:py-5 ${
        isAttention
          ? 'border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/80 shadow-[0_4px_14px_-4px_rgba(180,83,9,0.35),0_0_0_1px_rgba(251,191,36,0.4)] ring-2 ring-amber-300/30'
          : 'border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.06)]'
      }`}
    >
      {isAttention ? (
        <span
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/25 blur-2xl"
          aria-hidden
        />
      ) : null}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
              isAttention ? 'text-amber-900/80' : 'text-slate-500'
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-[2rem] sm:leading-none ${
              isAttention ? 'text-amber-950' : 'text-slate-900'
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isAttention
              ? 'border-amber-300/80 bg-amber-100 text-amber-700 group-hover:border-amber-400 group-hover:bg-amber-200/80'
              : 'border-slate-100 bg-slate-50 text-slate-400 group-hover:border-slate-200 group-hover:text-slate-500'
          }`}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={isAttention ? 2.25 : 1.75} />
        </div>
      </div>
    </div>
  );
}
