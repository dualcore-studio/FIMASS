import type { ReactNode } from 'react';

interface DashboardPanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function DashboardPanel({ title, description, children, className = '' }: DashboardPanelProps) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.05)] ${className}`}
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
