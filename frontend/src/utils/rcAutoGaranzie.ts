/** Garanzie RC Auto dalla richiesta (allineato al backend). */

function normalizeNome(s: unknown): string {
  return String(s ?? '').trim();
}

export function getRcGaranzieSelezionate(datiSpecifici: Record<string, unknown> | null | undefined): string[] {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const rawNew = datiSpecifici.garanzie_selezionate;
  if (Array.isArray(rawNew) && rawNew.length > 0) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const x of rawNew) {
      const n = normalizeNome(x);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  const legacy = datiSpecifici.garanzie_richieste;
  if (typeof legacy === 'string' && legacy.trim()) {
    const parts = legacy
      .split(/[,;\n\r]+/)
      .map((p) => normalizeNome(p))
      .filter(Boolean);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const n of parts) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  return [];
}
