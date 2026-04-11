import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertSeverity = 'critical' | 'warning' | 'neutral';

const severityStyles: Record<AlertSeverity, { badge: string; accent: string }> = {
  critical: {
    badge: 'bg-[var(--badge-soft-red-bg)] text-[var(--badge-soft-red-text)] ring-red-900/10',
    accent: '[border-left-color:var(--kpi-accent-risk)]',
  },
  warning: {
    badge: 'bg-[var(--badge-soft-orange-bg)] text-[var(--badge-soft-orange-text)] ring-amber-900/10',
    accent: '[border-left-color:var(--kpi-accent-work)]',
  },
  neutral: {
    badge: 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)] ring-slate-400/20',
    accent: '[border-left-color:var(--kpi-accent-info)]',
  },
};

interface DashboardAlertRowProps {
  label: string;
  value: number | string;
  severity: AlertSeverity;
  badgeText: string;
  action?: ReactNode;
}

export default function DashboardAlertRow({ label, value, severity, badgeText, action }: DashboardAlertRowProps) {
  const s = severityStyles[severity];
  return (
    <div
      className={`flex items-center gap-3 border-b border-[var(--portal-border-subtle)] border-l-[3px] border-solid bg-white px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-[rgba(42,77,126,0.035)] sm:px-5 ${s.accent}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${s.badge}`}
          >
            {badgeText}
          </span>
          <span className="text-sm font-medium text-slate-800">{label}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xl font-semibold tabular-nums text-slate-900">{value}</span>
        {action ?? <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />}
      </div>
    </div>
  );
}
