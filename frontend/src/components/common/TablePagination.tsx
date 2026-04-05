import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { getPaginationItems } from '../../utils/pagination';

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Sostantivo al plurale per il riepilogo, es. "preventivi", "log" */
  entityLabel: string;
  /** Override dimensione pagina (default TABLE_PAGE_SIZE). */
  pageSize?: number;
  className?: string;
}

export default function TablePagination({
  page,
  totalPages,
  total,
  onPageChange,
  entityLabel,
  pageSize = TABLE_PAGE_SIZE,
  className = '',
}: TablePaginationProps) {
  if (total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const items = getPaginationItems(page, totalPages);

  return (
    <div
      className={`border-t border-slate-200/90 bg-slate-50/90 px-3 py-3 sm:px-4 ${className}`}
      role="navigation"
      aria-label="Paginazione tabella"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <p className="text-center text-xs text-slate-600 lg:text-left">
          Mostrando{' '}
          <span className="font-semibold tabular-nums text-slate-900">
            {start}–{end}
          </span>{' '}
          di <span className="font-semibold tabular-nums text-slate-900">{total}</span> {entityLabel}
        </p>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-end">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Precedente</span>
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="hidden sm:inline">Successiva</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1 overflow-x-auto pb-0.5 sm:max-w-[min(100%,28rem)] lg:max-w-none lg:justify-end lg:pb-0">
          {items.map((item, idx) =>
            item === 'gap' ? (
              <span
                key={`gap-${idx}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-xs text-slate-400"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={`Pagina ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={`h-8 min-w-[2rem] shrink-0 rounded-lg px-2 text-xs font-semibold tabular-nums transition ${
                  item === page
                    ? 'bg-blue-700 text-white shadow-sm shadow-blue-900/15'
                    : 'border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ),
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
