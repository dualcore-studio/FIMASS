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
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900 sm:text-[1.85rem]">{title}</h1>
        {welcomeLine && <p className="mt-2 text-sm font-medium text-slate-700">{welcomeLine}</p>}
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{dateLabel}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-start gap-2.5">{actions}</div>}
    </header>
  );
}
