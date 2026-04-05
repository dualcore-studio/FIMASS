import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertSeverity = 'critical' | 'warning' | 'neutral';

const severityStyles: Record<AlertSeverity, { badge: string; accent: string }> = {
  critical: {
    badge: 'bg-red-50 text-red-800 ring-red-100',
    accent: 'border-l-red-500',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-900 ring-amber-100',
    accent: 'border-l-amber-500',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-200/80',
    accent: 'border-l-slate-400',
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
      className={`flex items-center gap-3 border-b border-slate-100 border-l-[3px] bg-white px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50/90 sm:px-5 ${s.accent}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${s.badge}`}
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
