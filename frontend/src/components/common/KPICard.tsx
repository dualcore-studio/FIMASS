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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className={`card p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`p-3 rounded-xl ${colors[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
