interface DashboardSecondaryMetricProps {
  label: string;
  value: number | string;
}

/** Compact inline metric for pipeline / secondary stats (below primary KPI row). */
export default function DashboardSecondaryMetric({ label, value }: DashboardSecondaryMetricProps) {
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col rounded-lg border border-slate-200/85 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800">{value}</span>
    </div>
  );
}
