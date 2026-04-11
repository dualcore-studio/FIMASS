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
      className={`kpi-card-top-bar flex flex-col overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(30,45,77,0.05),0_8px_28px_-12px_rgba(30,45,77,0.09)] ${className}`}
    >
      <div className="border-b border-[var(--portal-border-subtle)] bg-[linear-gradient(to_bottom,#fcfcfd,#f4f6f9)] px-4 py-4 sm:px-5">
        <h2 className="text-[0.95rem] font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{description}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
