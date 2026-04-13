import type { ChecklistItem, FormField } from '../types';

export function isFormFieldActive(f: FormField): boolean {
  const s = (f as { stato?: string }).stato;
  if (s == null || s === '') return true;
  return String(s).toLowerCase() !== 'disattivo';
}

export function isChecklistItemActive(c: ChecklistItem): boolean {
  const s = (c as { stato?: string }).stato;
  if (s == null || s === '') return true;
  return String(s).toLowerCase() !== 'disattivo';
}

export function sortByOrdine<T extends { ordine?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
}

export function activeCampiForFlow(campi: FormField[]): FormField[] {
  return sortByOrdine(campi.filter(isFormFieldActive));
}

/** Valuta condizione tipo `campo=valore` sui dati specifici (stesso formato del seed). */
export function checklistItemApplies(item: ChecklistItem, datiSpecifici: Record<string, unknown>): boolean {
  const raw = (item as { condizione?: string }).condizione;
  if (raw == null || String(raw).trim() === '') return true;
  const cond = String(raw).trim();
  const eq = cond.indexOf('=');
  if (eq <= 0) return true;
  const key = cond.slice(0, eq).trim();
  const expected = cond.slice(eq + 1).trim();
  const actual = datiSpecifici[key];
  if (actual === undefined || actual === null) return false;
  return String(actual).trim() === expected;
}

export function activeChecklistForFlow(
  items: ChecklistItem[],
  datiSpecifici: Record<string, unknown>,
): ChecklistItem[] {
  return sortByOrdine(
    items.filter((c) => isChecklistItemActive(c) && checklistItemApplies(c, datiSpecifici)),
  );
}

export function mandatoryChecklistMissing(
  items: ChecklistItem[],
  files: Record<string, File | null>,
  datiSpecifici: Record<string, unknown>,
): string[] {
  const active = activeChecklistForFlow(items, datiSpecifici);
  const missing: string[] = [];
  for (const c of active) {
    if (!c.obbligatorio) continue;
    const f = files[c.nome];
    if (f == null) missing.push(`Allegato obbligatorio mancante: «${c.nome}».`);
  }
  return missing;
}
