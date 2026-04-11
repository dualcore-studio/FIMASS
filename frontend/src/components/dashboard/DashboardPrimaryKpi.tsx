import type { LucideIcon } from 'lucide-react';

export type DashboardKpiAccent =
  | 'default'
  | 'info'
  | 'institutional'
  | 'work'
  | 'standby'
  | 'risk'
  | 'done'
  | 'attention';

interface DashboardPrimaryKpiProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Accento cromatico superiore (stile Sportello Amico). */
  accent?: DashboardKpiAccent;
  /** Evidenzia la card (es. solleciti): variante sobria su card bianca. */
  variant?: 'default' | 'attention';
}

const accentTopClass: Record<DashboardKpiAccent, string> = {
  default: 'kpi-accent-default',
  info: 'kpi-accent-info',
  institutional: 'kpi-accent-institutional',
  work: 'kpi-accent-work',
  standby: 'kpi-accent-standby',
  risk: 'kpi-accent-risk',
  done: 'kpi-accent-done',
  attention: 'kpi-accent-attention',
};

const valueToneClass: Record<DashboardKpiAccent, string> = {
  default: 'kpi-value-neutral',
  info: 'kpi-value-info',
  institutional: 'kpi-value-institutional',
  work: 'kpi-value-work',
  standby: 'kpi-value-standby',
  risk: 'kpi-value-risk',
  done: 'kpi-value-done',
  attention: 'kpi-value-attention',
};

export default function DashboardPrimaryKpi({
  label,
  value,
  icon: Icon,
  accent = 'institutional',
  variant = 'default',
}: DashboardPrimaryKpiProps) {
  const isAttention = variant === 'attention';
  const topAccent = isAttention ? 'attention' : accent;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/85 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(30,45,77,0.05),0_8px_28px_-12px_rgba(30,45,77,0.1)] sm:px-5 sm:py-5 ${
        accentTopClass[topAccent]
      } ${isAttention ? 'ring-1 ring-amber-200/65' : ''}`}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
              isAttention ? 'text-amber-900/75' : 'text-slate-600'
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-[2rem] sm:leading-none ${
              isAttention ? 'kpi-value-attention' : valueToneClass[accent]
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors duration-150 ${
            isAttention
              ? 'border-amber-200/80 bg-[#faf8f0] text-[#7a6220] group-hover:border-amber-300/90'
              : 'border-slate-100/95 bg-slate-50/95 text-slate-400 group-hover:border-slate-200 group-hover:bg-white group-hover:text-slate-500'
          }`}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={isAttention ? 2.1 : 1.75} />
        </div>
      </div>
    </div>
  );
}
