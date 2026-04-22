import { parse, startOfMonth } from 'date-fns';

export function parseMonthKey(m: string | null): Date {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return startOfMonth(new Date());
  return startOfMonth(parse(`${m}-01`, 'yyyy-MM-dd', new Date()));
}
