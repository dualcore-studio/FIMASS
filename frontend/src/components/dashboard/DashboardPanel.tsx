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
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_16px_-8px_rgba(15,23,42,0.07)] ${className}`}
    >
      <div className="border-b border-[var(--portal-border-subtle)] bg-[linear-gradient(to_bottom,#fafbfc,#f4f6f9)] px-4 py-3.5 sm:px-5">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
