import type { ReactNode } from 'react';

export type DetailFieldColSpan = 1 | 2 | 3 | 'full';

const spanClasses: Record<DetailFieldColSpan, string> = {
  1: '',
  2: 'sm:col-span-2',
  3: 'sm:col-span-2 lg:col-span-3',
  full: 'col-span-full',
};

export function DetailField({
  label,
  value,
  mono,
  colSpan = 1,
  className = '',
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  colSpan?: DetailFieldColSpan;
  className?: string;
}) {
  const empty =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim());

  return (
    <div className={`min-w-0 ${spanClasses[colSpan]} ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={`mt-0.5 break-words text-sm leading-snug text-gray-900 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {empty ? <span className="text-gray-400">—</span> : value}
      </div>
    </div>
  );
}
