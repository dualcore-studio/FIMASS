import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDirection } from '../../hooks/useListTableSort';

export interface SortableThProps {
  children: React.ReactNode;
  sortKey: string;
  activeKey: string | null;
  direction: SortDirection;
  onRequestSort: (key: string) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export default function SortableTh({
  children,
  sortKey,
  activeKey,
  direction,
  onRequestSort,
  align = 'left',
  className = '',
}: SortableThProps) {
  const active = activeKey === sortKey;
  const alignBtn =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
        ? 'justify-center text-center'
        : 'justify-start text-left';

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-3 font-semibold text-gray-700 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
    >
      <button
        type="button"
        onClick={() => onRequestSort(sortKey)}
        className={`group cursor-pointer inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 -my-1 font-semibold text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${alignBtn} ${
          active
            ? 'bg-blue-50/90 text-blue-900 ring-1 ring-blue-200/70'
            : 'hover:bg-slate-100/90 hover:text-slate-900'
        }`}
      >
        <span className="min-w-0 truncate">{children}</span>
        <span className="inline-flex h-4 w-4 shrink-0 text-slate-400" aria-hidden>
          {active ? (
            direction === 'asc' ? (
              <ArrowUp className="h-4 w-4 text-blue-700" strokeWidth={2.25} />
            ) : (
              <ArrowDown className="h-4 w-4 text-blue-700" strokeWidth={2.25} />
            )
          ) : (
            <ArrowUpDown
              className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-80"
              strokeWidth={2}
            />
          )}
        </span>
      </button>
    </th>
  );
}
