import type { ReactNode } from 'react';

interface DashboardPageHeaderProps {
  title: string;
  welcomeLine?: string;
  dateLabel: string;
  description: string;
  actions?: ReactNode;
}

export default function DashboardPageHeader({
  title,
  welcomeLine,
  dateLabel,
  description,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.7rem]">{title}</h1>
        {welcomeLine && <p className="mt-1.5 text-sm font-medium text-slate-800">{welcomeLine}</p>}
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{dateLabel}</p>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
