import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChevronDown, ExternalLink, FilePlus2, Loader2, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { ScadenzaPolicyRow, ScadenzeApiResponse, StatoScadenza, StructureOption, User } from '../../types';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthSelectOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -24; i <= 18; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const raw = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    out.push({ value, label });
  }
  return out;
}

function sortScadenzeRows(rows: ScadenzaPolicyRow[]): ScadenzaPolicyRow[] {
  const rank: Record<StatoScadenza, number> = { Scaduta: 0, 'Da rinnovare': 1, Rinnovata: 2 };
  return [...rows].sort((a, b) => {
    const dr = rank[a.stato_scadenza] - rank[b.stato_scadenza];
    if (dr !== 0) return dr;
    return String(a.data_scadenza || '').localeCompare(String(b.data_scadenza || ''), 'it');
  });
}

function StatoScadenzaBadge({ stato }: { stato: StatoScadenza }) {
  const cls =
    stato === 'Da rinnovare'
      ? 'bg-red-100 text-red-800 ring-red-200/60'
      : stato === 'Scaduta'
        ? 'bg-slate-200 text-slate-700 ring-slate-300/50'
        : 'bg-emerald-100 text-emerald-800 ring-emerald-200/60';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {stato}
    </span>
  );
}

function FilterCell({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-px">
      <label htmlFor={id} className="whitespace-nowrap text-[11px] font-normal leading-tight text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function ScadenzaRowMenu({
  row,
  onRinnovata,
}: {
  row: ScadenzaPolicyRow;
  onRinnovata: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const canMarkRinnovata = row.stato_scadenza !== 'Rinnovata';

  return (
    <div className="relative flex justify-end" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Azioni
        <ChevronDown className="size-3.5 opacity-70" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <Link
            to={`/polizze/${row.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="size-3.5 shrink-0 opacity-70" />
            Apri
          </Link>
          {canMarkRinnovata ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onRinnovata(row.id);
              }}
            >
              <RefreshCw className="size-3.5 shrink-0 opacity-70" />
              Segna come rinnovata
            </button>
          ) : null}
          <Link
            to="/preventivi/nuovo"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <FilePlus2 className="size-3.5 shrink-0 opacity-70" />
            Crea preventivo rinnovo
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function ScadenzePage() {
  const { user } = useAuth();
  const role = user?.role;

  const [month, setMonth] = useState(currentMonthKey);
  const [raw, setRaw] = useState<ScadenzeApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statoFilter, setStatoFilter] = useState<'' | StatoScadenza>('');
  const [strutturaFilter, setStrutturaFilter] = useState('');
  const [operatoreFilter, setOperatoreFilter] = useState('');
  const [soloScadute, setSoloScadute] = useState(false);
  const [soloDaRinnovare, setSoloDaRinnovare] = useState(false);

  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [assignees, setAssignees] = useState<User[]>([]);

  const canFilterStruttura = role === 'admin' || role === 'supervisore';

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!canFilterStruttura) return;
    api.get<StructureOption[]>('/users/structures').then(setStructures).catch(() => {});
    api.get<User[]>('/users/assignees').then(setAssignees).catch(() => {});
  }, [canFilterStruttura]);

  const fetchData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<ScadenzeApiResponse>(`/scadenze?month=${encodeURIComponent(month)}`);
      setRaw(data);
    } catch (e) {
      setRaw(null);
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare le scadenze.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!raw?.items) return [];
    let rows = raw.items;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter((r) => r.contraente.toLowerCase().includes(q));
    }
    if (statoFilter) {
      rows = rows.filter((r) => r.stato_scadenza === statoFilter);
    }
    if (strutturaFilter) {
      const sid = Number(strutturaFilter);
      rows = rows.filter((r) => Number(r.struttura_id) === sid);
    }
    if (operatoreFilter) {
      const oid = Number(operatoreFilter);
      rows = rows.filter((r) => Number(r.incaricato_user_id) === oid);
    }
    if (soloScadute) rows = rows.filter((r) => r.stato_scadenza === 'Scaduta');
    if (soloDaRinnovare) rows = rows.filter((r) => r.stato_scadenza === 'Da rinnovare');
    return sortScadenzeRows(rows);
  }, [
    raw,
    debouncedSearch,
    statoFilter,
    strutturaFilter,
    operatoreFilter,
    soloScadute,
    soloDaRinnovare,
  ]);

  const cardSummary = useMemo(() => {
    const totale = filtered.length;
    const daRinnovare = filtered.filter((r) => r.stato_scadenza === 'Da rinnovare').length;
    const scadute = filtered.filter((r) => r.stato_scadenza === 'Scaduta').length;
    const rinnovate = filtered.filter((r) => r.stato_scadenza === 'Rinnovata').length;
    return { totale, daRinnovare, scadute, rinnovate };
  }, [filtered]);

  const onRinnovata = async (id: number) => {
    setActionError(null);
    try {
      await api.patch(`/policies/${id}/rinnovata`, { rinnovata: true });
      await fetchData();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    }
  };

  const tf = 'input-field h-9 w-full min-w-0 py-1.5 text-sm';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <CalendarRange className="size-7 text-blue-700 opacity-90" strokeWidth={1.5} />
            Scadenze Polizze
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Gestione rinnovi e scadenze del portafoglio
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <label htmlFor="scadenze-mese" className="text-[11px] font-medium text-gray-600">
            Mese di riferimento
          </label>
          <select
            id="scadenze-mese"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={`${tf} sm:w-56`}
          >
            {monthSelectOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Totale scadenze mese', value: cardSummary.totale, accent: 'border-slate-200 bg-white' },
          { label: 'Da rinnovare', value: cardSummary.daRinnovare, accent: 'border-red-100 bg-red-50/50' },
          { label: 'Scadute', value: cardSummary.scadute, accent: 'border-slate-200 bg-slate-50/80' },
          { label: 'Rinnovate', value: cardSummary.rinnovate, accent: 'border-emerald-100 bg-emerald-50/50' },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border px-4 py-3 shadow-sm ${c.accent}`}
          >
            <p className="text-xs font-medium text-gray-600">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card px-2.5 py-2 sm:px-3 sm:py-2">
        <div className="flex w-full flex-wrap items-end gap-2 lg:flex-nowrap">
          <span className="sr-only">Filtri scadenze</span>
          <FilterCell id="scad-search" label="Cerca contraente">
            <input
              id="scad-search"
              type="search"
              placeholder="Nome o cognome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={tf}
            />
          </FilterCell>
          <FilterCell id="scad-stato" label="Stato scadenza">
            <select
              id="scad-stato"
              value={statoFilter}
              onChange={(e) => setStatoFilter(e.target.value as '' | StatoScadenza)}
              className={tf}
            >
              <option value="">Tutti</option>
              <option value="Da rinnovare">Da rinnovare</option>
              <option value="Scaduta">Scaduta</option>
              <option value="Rinnovata">Rinnovata</option>
            </select>
          </FilterCell>
          {canFilterStruttura ? (
            <>
              <FilterCell id="scad-struttura" label="Struttura">
                <select
                  id="scad-struttura"
                  value={strutturaFilter}
                  onChange={(e) => setStrutturaFilter(e.target.value)}
                  className={tf}
                >
                  <option value="">Tutte</option>
                  {structures.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.denominazione || getUserDisplayName(s)}
                    </option>
                  ))}
                </select>
              </FilterCell>
              <FilterCell id="scad-op" label="Operatore">
                <select
                  id="scad-op"
                  value={operatoreFilter}
                  onChange={(e) => setOperatoreFilter(e.target.value)}
                  className={tf}
                >
                  <option value="">Tutti</option>
                  {assignees.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {getUserDisplayName(o)}
                      {o.role === 'fornitore' ? ' (Fornitore)' : ''}
                    </option>
                  ))}
                </select>
              </FilterCell>
            </>
          ) : null}
          <FilterCell id="scad-solo-scadute" label="Solo scadute">
            <button
              type="button"
              id="scad-solo-scadute"
              role="switch"
              aria-checked={soloScadute}
              onClick={() => setSoloScadute((v) => !v)}
              className={`flex h-9 w-full min-w-[7rem] items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                soloScadute
                  ? 'border-slate-700 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {soloScadute ? 'Sì' : 'No'}
            </button>
          </FilterCell>
          <FilterCell id="scad-solo-da-rinnovare" label="Solo da rinnovare">
            <button
              type="button"
              id="scad-solo-da-rinnovare"
              role="switch"
              aria-checked={soloDaRinnovare}
              onClick={() => setSoloDaRinnovare((v) => !v)}
              className={`flex h-9 w-full min-w-[7rem] items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                soloDaRinnovare
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {soloDaRinnovare ? 'Sì' : 'No'}
            </button>
          </FilterCell>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="size-10 animate-spin text-blue-700" />
            <p className="text-sm text-gray-500">Caricamento scadenze…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">
              {(raw?.items.length ?? 0) === 0
                ? 'Nessuna polizza in scadenza nel mese selezionato'
                : 'Nessun risultato con i filtri applicati'}
            </p>
            <p className="max-w-md text-xs text-gray-500">
              Le scadenze sono calcolate sulle polizze in stato EMESSA con data di scadenza nel mese scelto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Data scadenza</th>
                  <th>Contraente</th>
                  <th>Tipologia</th>
                  <th>Compagnia</th>
                  <th>Struttura</th>
                  <th>Operatore</th>
                  <th>Stato</th>
                  <th className="text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap font-medium text-gray-900">{formatDate(row.data_scadenza)}</td>
                    <td>{row.contraente}</td>
                    <td>{row.tipologia}</td>
                    <td className="text-gray-700">{row.compagnia ?? '—'}</td>
                    <td>{row.struttura}</td>
                    <td>{row.operatore}</td>
                    <td>
                      <StatoScadenzaBadge stato={row.stato_scadenza} />
                    </td>
                    <td className="text-right">
                      <ScadenzaRowMenu row={row} onRinnovata={onRinnovata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
