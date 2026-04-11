import type { ReactNode } from 'react';

interface DashboardPageHeaderProps {
  title: string;
  welcomeLine?: string;
  dateLabel: string;
  actions?: ReactNode;
}

export default function DashboardPageHeader({ title, welcomeLine, dateLabel, actions }: DashboardPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <h1 className="min-w-0 text-[1.65rem] font-bold uppercase tracking-[0.08em] text-slate-900 sm:text-[1.85rem]">
          {title}
        </h1>
        <div className="min-w-0 sm:max-w-[min(100%,28rem)] sm:text-right">
          {welcomeLine ? <p className="text-sm font-medium text-slate-800">{welcomeLine}</p> : null}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{dateLabel}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-shrink-0 flex-wrap items-start gap-2.5">{actions}</div> : null}
    </header>
  );
}
