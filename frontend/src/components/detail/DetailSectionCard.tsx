import type { ReactNode } from 'react';

type Variant = 'default' | 'muted' | 'amber' | 'sky';

const variantClass: Record<Variant, string> = {
  default: 'card p-4',
  muted: 'card border border-slate-200/90 bg-slate-50/50 p-4',
  amber: 'card border border-amber-100 bg-amber-50/50 p-4',
  sky: 'card border border-sky-100 bg-sky-50/40 p-4',
};

const variantTitleClass: Record<Variant, string> = {
  default: 'text-gray-500',
  muted: 'text-gray-500',
  amber: 'text-amber-900/90',
  sky: 'text-sky-900/90',
};

export function DetailSectionCard({
  title,
  children,
  className = '',
  bodyClassName = '',
  variant = 'default',
  titleClassName = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  variant?: Variant;
  titleClassName?: string;
}) {
  return (
    <div className={`${variantClass[variant]} ${className}`}>
      <h3
        className={`mb-2.5 text-[11px] font-semibold uppercase tracking-wider ${variantTitleClass[variant]} ${titleClassName}`}
      >
        {title}
      </h3>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
