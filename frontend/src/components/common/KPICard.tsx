import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  subtitle?: string;
  onClick?: () => void;
}

export default function KPICard({ title, value, icon, color = 'blue', subtitle, onClick }: KPICardProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-800',
    green: 'bg-emerald-500/10 text-emerald-800',
    amber: 'bg-amber-500/10 text-amber-800',
    red: 'bg-red-500/10 text-red-800',
    purple: 'bg-purple-500/10 text-purple-800',
    slate: 'bg-slate-500/10 text-slate-700',
  };

  return (
    <div
      className={`card rounded-[12px] p-5 ${onClick ? 'cursor-pointer transition-[border-color,box-shadow,background-color] hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08)]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-600">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${colors[color]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
