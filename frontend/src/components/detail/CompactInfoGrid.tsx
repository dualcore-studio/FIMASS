import type { ReactNode } from 'react';

type GridColumns = 'responsive-3' | 'two';

const gridClass: Record<GridColumns, string> = {
  'responsive-3':
    'grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-5',
  two: 'grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2',
};

export function CompactInfoGrid({
  children,
  columns = 'responsive-3',
  className = '',
}: {
  children: ReactNode;
  columns?: GridColumns;
  className?: string;
}) {
  return <div className={`${gridClass[columns]} ${className}`}>{children}</div>;
}
