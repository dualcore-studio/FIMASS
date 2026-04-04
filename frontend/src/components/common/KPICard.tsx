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
    blue: 'bg-blue-500/15 text-blue-300',
    green: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    red: 'bg-red-500/15 text-red-300',
    purple: 'bg-purple-500/15 text-purple-300',
    slate: 'bg-slate-500/15 text-slate-300',
  };

  return (
    <div
      className={`card rounded-[12px] p-5 ${onClick ? 'cursor-pointer transition-colors hover:border-white/15 hover:bg-[#232c42]/90' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-slate-50">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${colors[color]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
