import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  CalendarRange,
  ChevronDown,
  ExternalLink,
  FilePlus2,
  Loader2,
  RefreshCw,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { ScadenzaDetailResponse, ScadenzaPolicyRow, ScadenzeApiResponse, StatoScadenza } from '../../types';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';

const SCADENZE_MENU_WIDTH = 240;
const SCADENZE_VIEW_MARGIN = 8;
const SCADENZE_MENU_GAP = 4;

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

const STATO_RANK: Record<StatoScadenza, number> = {
  Scaduta: 0,
  'Da rinnovare': 1,
  'Preventivo rinnovo creato': 2,
  'Non rinnovata': 3,
  Rinnovata: 4,
};

function sortScadenzeRows(rows: ScadenzaPolicyRow[]): ScadenzaPolicyRow[] {
  return [...rows].sort((a, b) => {
    const dr = STATO_RANK[a.stato_scadenza] - STATO_RANK[b.stato_scadenza];
    if (dr !== 0) return dr;
    return String(a.data_scadenza || '').localeCompare(String(b.data_scadenza || ''), 'it');
  });
}

function normalizeContraenteSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** Match su nome, cognome o ordine invertito: ogni “parola” della ricerca deve comparire nel testo contraente. */
function contraenteMatchesSearch(contraente: string, query: string): boolean {
  const q = normalizeContraenteSearch(query);
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = normalizeContraenteSearch(contraente);
  return tokens.every((t) => hay.includes(t));
}

function StatoScadenzaBadge({ stato }: { stato: StatoScadenza }) {
  const cls =
    stato === 'Da rinnovare'
      ? 'bg-rose-50 text-rose-800 ring-rose-200/80'
      : stato === 'Scaduta'
        ? 'bg-slate-100 text-slate-700 ring-slate-300/60'
        : stato === 'Rinnovata'
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/70'
          : stato === 'Non rinnovata'
            ? 'bg-amber-50 text-amber-900 ring-amber-200/70'
            : 'bg-indigo-50 text-indigo-900 ring-indigo-200/75';
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ring-inset ${cls}`}
    >
      {stato}
    </span>
  );
}

type MenuPos = { top: number; left: number; maxHeightPx?: number };

function ScadenzaRowMenu({
  row,
  role,
  onOpenDetail,
  onAskCreateRenewal,
  onNonRinnovata,
  onManualRinnovata,
  onReopen,
}: {
  row: ScadenzaPolicyRow;
  role: string | undefined;
  onOpenDetail: () => void;
  onAskCreateRenewal: () => void;
  onNonRinnovata: () => void;
  onManualRinnovata: () => void;
  onReopen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = wrapRef.current?.querySelector<HTMLElement>('[data-scadenze-actions-trigger]');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - SCADENZE_MENU_WIDTH;
    if (left < SCADENZE_VIEW_MARGIN) left = SCADENZE_VIEW_MARGIN;
    if (left + SCADENZE_MENU_WIDTH > vw - SCADENZE_VIEW_MARGIN) {
      left = vw - SCADENZE_MENU_WIDTH - SCADENZE_VIEW_MARGIN;
    }
    const menuEl = menuRef.current;
    const cap = Math.min(360, vh * 0.7);
    const rawContent = menuEl?.scrollHeight ?? 200;
    const contentH = Math.min(Math.max(rawContent, 1), cap);
    const spaceBelow = Math.max(0, vh - SCADENZE_VIEW_MARGIN - r.bottom - SCADENZE_MENU_GAP);
    const spaceAbove = Math.max(0, r.top - SCADENZE_VIEW_MARGIN - SCADENZE_MENU_GAP);
    let top: number;
    let maxHeightPx: number | undefined;
    if (contentH <= spaceBelow) {
      top = r.bottom + SCADENZE_MENU_GAP;
    } else if (contentH <= spaceAbove) {
      top = r.top - contentH - SCADENZE_MENU_GAP;
    } else if (spaceBelow >= spaceAbove) {
      top = r.bottom + SCADENZE_MENU_GAP;
      maxHeightPx = Math.max(1, spaceBelow);
    } else {
      maxHeightPx = Math.max(1, spaceAbove);
      top = r.top - maxHeightPx - SCADENZE_MENU_GAP;
    }
    const boxH = maxHeightPx ?? contentH;
    if (top + boxH > vh - SCADENZE_VIEW_MARGIN) {
      top = Math.max(SCADENZE_VIEW_MARGIN, vh - SCADENZE_VIEW_MARGIN - boxH);
    }
    setMenuPos({ top, left, maxHeightPx });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const t = window.setTimeout(updatePosition, 0);
    return () => window.clearTimeout(t);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  const isFinal = row.stato_scadenza === 'Rinnovata' || row.stato_scadenza === 'Non rinnovata';
  const canCreateRenewal = role === 'struttura' && !isFinal && !row.renewal_quote_id;
  const canOpenRenewalQuote = Boolean(row.renewal_quote_id);
  const canNonRinnovata =
    (role === 'admin' || role === 'supervisore' || role === 'struttura') && !isFinal;
  const canManualRinnovata =
    (role === 'admin' || role === 'supervisore') && row.stato_scadenza !== 'Non rinnovata';
  const canReopen = (role === 'admin' || role === 'supervisore') && row.stato_scadenza === 'Non rinnovata';

  const menu =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        className="fixed z-[200] min-w-[200px] overflow-y-auto rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-xl ring-1 ring-slate-900/5"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: SCADENZE_MENU_WIDTH,
          ...(menuPos.maxHeightPx != null ? { maxHeight: menuPos.maxHeightPx } : {}),
        }}
        role="menu"
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50"
          onClick={() => {
            setOpen(false);
            onOpenDetail();
          }}
        >
          <ExternalLink className="size-3.5 shrink-0 text-slate-500" />
          Apri dettaglio
        </button>
        <Link
          to={`/polizze/${row.id}`}
          className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-800 transition hover:bg-slate-50"
          onClick={() => setOpen(false)}
        >
          <ExternalLink className="size-3.5 shrink-0 text-slate-500" />
          Scheda polizza
        </Link>
        {canCreateRenewal ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onAskCreateRenewal();
            }}
          >
            <FilePlus2 className="size-3.5 shrink-0 text-slate-500" />
            Crea preventivo rinnovo
          </button>
        ) : null}
        {canOpenRenewalQuote && row.renewal_quote_id ? (
          <Link
            to={`/preventivi/${row.renewal_quote_id}`}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-800 transition hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="size-3.5 shrink-0 text-slate-500" />
            Apri preventivo rinnovo
          </Link>
        ) : null}
        {canNonRinnovata ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onNonRinnovata();
            }}
          >
            <Ban className="size-3.5 shrink-0 text-slate-500" />
            Segna come non rinnovata
          </button>
        ) : null}
        {canManualRinnovata && row.stato_scadenza !== 'Rinnovata' ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-amber-900 transition hover:bg-amber-50/80"
            onClick={() => {
              setOpen(false);
              onManualRinnovata();
            }}
          >
            <ShieldCheck className="size-3.5 shrink-0 text-amber-700" />
            Segna come rinnovata (manuale)
          </button>
        ) : null}
        {canReopen ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onReopen();
            }}
          >
            <RefreshCw className="size-3.5 shrink-0 text-slate-500" />
            Riapri a rinnovo (correzione)
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <div className="flex justify-end" ref={wrapRef}>
        <button
          type="button"
          data-scadenze-actions-trigger
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Azioni
          <ChevronDown className="size-3.5 text-slate-500" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[190]" aria-hidden onClick={() => setOpen(false)} />
      ) : null}
      {menu && createPortal(menu, document.body)}
    </>
  );
}

const cellBase = 'px-4 py-3.5 align-middle text-sm text-slate-800';
const cellEllipsis = `${cellBase} max-w-[10rem] min-w-0 truncate sm:max-w-[12rem]`;
const cellWide = `${cellBase} min-w-0 max-w-[14rem]`;

export default function ScadenzePage() {
  const { user } = useAuth();
  const role = user?.role;

  const [month, setMonth] = useState(currentMonthKey);
  const [raw, setRaw] = useState<ScadenzeApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ScadenzaDetailResponse | null>(null);

  const [renewalTarget, setRenewalTarget] = useState<ScadenzaPolicyRow | null>(null);
  const [renewalPrivacy, setRenewalPrivacy] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);

  const [manualRinnovataTarget, setManualRinnovataTarget] = useState<ScadenzaPolicyRow | null>(null);
  const [manualRinnovataPolicyId, setManualRinnovataPolicyId] = useState('');
  const [manualRinnovataSubmitting, setManualRinnovataSubmitting] = useState(false);

  const [nonRinnovataTarget, setNonRinnovataTarget] = useState<ScadenzaPolicyRow | null>(null);
  const [nonRinnovataSubmitting, setNonRinnovataSubmitting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

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

  const openDetail = async (policyId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setActionError(null);
    try {
      const d = await api.get<ScadenzaDetailResponse>(`/scadenze/${policyId}`);
      setDetail(d);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Impossibile caricare il dettaglio.');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!raw?.items) return [];
    let rows = raw.items;
    if (debouncedSearch) {
      rows = rows.filter((r) => contraenteMatchesSearch(r.contraente, debouncedSearch));
    }
    return sortScadenzeRows(rows);
  }, [raw, debouncedSearch]);

  const monthSummary = raw?.summary;

  const submitRenewal = async () => {
    if (!renewalTarget || !renewalPrivacy) return;
    setRenewalSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/scadenze/${renewalTarget.id}/renewal-quote`, {
        privacy_consent_accepted: true,
      });
      setActionSuccess('Preventivo di rinnovo creato con successo.');
      setRenewalTarget(null);
      setRenewalPrivacy(false);
      await fetchData();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.details as { existing_quote_id?: number; error?: string } | undefined;
        const id = body?.existing_quote_id;
        setActionError(
          id
            ? `${body?.error || 'Preventivo già presente.'} Puoi aprirlo dalla colonna Azioni (id ${id}).`
            : body?.error || 'Preventivo di rinnovo già esistente.',
        );
      } else {
        setActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
      }
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const submitNonRinnovata = async () => {
    if (!nonRinnovataTarget) return;
    setNonRinnovataSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.patch(`/scadenze/${nonRinnovataTarget.id}/non-rinnovata`, {});
      setActionSuccess('Scadenza segnata come non rinnovata.');
      setNonRinnovataTarget(null);
      await fetchData();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setNonRinnovataSubmitting(false);
    }
  };

  const submitManualRinnovata = async () => {
    if (!manualRinnovataTarget) return;
    setManualRinnovataSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const rawId = manualRinnovataPolicyId.trim();
      await api.patch(`/scadenze/${manualRinnovataTarget.id}/rinnovata-manuale`, {
        renewed_by_policy_id: rawId ? Number(rawId) : undefined,
      });
      setActionSuccess('Scadenza segnata come rinnovata.');
      setManualRinnovataTarget(null);
      setManualRinnovataPolicyId('');
      await fetchData();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setManualRinnovataSubmitting(false);
    }
  };

  const submitReopen = async (row: ScadenzaPolicyRow) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/scadenze/${row.id}/reopen-renewal`, {});
      setActionSuccess('Scadenza riaperta al flusso rinnovi.');
      await fetchData();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    }
  };

  const tf = 'input-field h-9 w-full min-w-0 border-slate-200 py-1.5 text-sm shadow-sm';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <CalendarRange className="size-7 text-blue-800 opacity-90" strokeWidth={1.5} />
            Scadenze Polizze
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Gestione rinnovi e scadenze del portafoglio
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <label htmlFor="scadenze-mese" className="text-xs font-medium text-slate-500">
            Mese di riferimento
          </label>
          <select
            id="scadenze-mese"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={`${tf} min-w-[12rem] sm:w-56`}
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
        <div className="rounded-lg border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800">{actionError}</div>
      ) : null}
      {actionSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
          {actionSuccess}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Totale scadenze mese',
            value: monthSummary?.totale ?? 0,
            accent: 'border-slate-200/80 bg-white shadow-sm',
            hint: null as string | null,
          },
          {
            label: 'Da rinnovare (funnel)',
            value: monthSummary?.daRinnovare ?? 0,
            accent: 'border-rose-100/80 bg-gradient-to-br from-rose-50/80 to-white shadow-sm',
            hint: 'Include pratiche con preventivo di rinnovo ancora aperto',
          },
          {
            label: 'Scadute (calendario)',
            value: monthSummary?.scadute ?? 0,
            accent: 'border-slate-200/80 bg-slate-50/50 shadow-sm',
            hint: 'Data passata, non chiuse come rinnovate o non rinnovate',
          },
          {
            label: 'Rinnovate',
            value: monthSummary?.rinnovate ?? 0,
            accent: 'border-emerald-100/80 bg-gradient-to-br from-emerald-50/70 to-white shadow-sm',
            hint: null,
          },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border px-4 py-3.5 ${c.accent}`}>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{c.value}</p>
            {c.hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{c.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="flex w-full justify-stretch sm:justify-start">
        <div className="inline-flex w-full max-w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm sm:w-fit sm:max-w-none sm:px-3.5 sm:py-3">
          <label htmlFor="scad-search" className="sr-only">
            Cerca per nome o cognome del contraente
          </label>
          <input
            id="scad-search"
            type="search"
            placeholder="Cerca per nome o cognome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            className={`${tf} box-border w-full min-w-0 sm:min-w-[300px] sm:w-[380px] lg:w-[420px]`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="size-10 animate-spin text-blue-700" />
            <p className="text-sm text-slate-500">Caricamento scadenze…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800">
              {(raw?.items.length ?? 0) === 0
                ? 'Nessuna polizza in scadenza nel mese selezionato'
                : debouncedSearch
                  ? 'Nessun contraente corrisponde alla ricerca'
                  : 'Nessun risultato'}
            </p>
            <p className="max-w-md text-xs text-slate-500">
              Le scadenze mostrano le polizze in stato EMESSA con data di scadenza (effettiva) nel mese scelto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="portal-table w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr>
                  <th
                    className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Data scadenza
                  </th>
                  <th
                    className="min-w-0 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Contraente
                  </th>
                  <th
                    className="min-w-0 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Tipologia
                  </th>
                  <th
                    className="min-w-0 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Compagnia
                  </th>
                  <th
                    className="min-w-0 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Struttura
                  </th>
                  <th
                    className="min-w-0 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Operatore
                  </th>
                  <th
                    className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Stato
                  </th>
                  <th
                    className="w-[7.5rem] min-w-[7.5rem] px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                    scope="col"
                  >
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {filtered.map((row) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-slate-50/80">
                    <td className={`${cellBase} whitespace-nowrap font-semibold text-slate-900`}>
                      {formatDate(row.data_scadenza)}
                    </td>
                    <td className={cellWide} title={row.contraente}>
                      {row.contraente}
                    </td>
                    <td className={cellEllipsis} title={row.tipologia}>
                      {row.tipologia}
                    </td>
                    <td className={cellEllipsis} title={row.compagnia ?? undefined}>
                      {row.compagnia ?? '—'}
                    </td>
                    <td className={cellEllipsis} title={row.struttura}>
                      {row.struttura}
                    </td>
                    <td className={cellEllipsis} title={row.operatore}>
                      {row.operatore}
                    </td>
                    <td className={`${cellBase} whitespace-nowrap`}>
                      <StatoScadenzaBadge stato={row.stato_scadenza} />
                    </td>
                    <td className="w-[7.5rem] min-w-[7.5rem] px-4 py-3.5 text-right align-middle">
                      <ScadenzaRowMenu
                        row={row}
                        role={role}
                        onOpenDetail={() => void openDetail(row.id)}
                        onAskCreateRenewal={() => {
                          setRenewalPrivacy(false);
                          setRenewalTarget(row);
                        }}
                        onNonRinnovata={() => setNonRinnovataTarget(row)}
                        onManualRinnovata={() => {
                          setManualRinnovataPolicyId('');
                          setManualRinnovataTarget(row);
                        }}
                        onReopen={() => void submitReopen(row)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        title="Dettaglio scadenza"
        size="lg"
      >
        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-blue-700" />
          </div>
        ) : detail ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Polizza</p>
              <p className="mt-1 font-semibold text-slate-900">
                {detail.policy.numero} — {detail.policy.contraente}
              </p>
              <p className="text-slate-600">{detail.policy.tipologia}</p>
              <p className="mt-2 text-slate-600">
                Scadenza: <span className="font-medium">{formatDate(detail.policy.data_scadenza)}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatoScadenzaBadge stato={detail.stato_scadenza} />
                <Link
                  to={`/polizze/${detail.policy.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                >
                  Scheda polizza <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
            {detail.renewal_quote ? (
              <div>
                <p className="text-xs font-semibold text-slate-500">Preventivo rinnovo</p>
                <Link
                  to={`/preventivi/${detail.renewal_quote.id}`}
                  className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                >
                  {detail.renewal_quote.numero} ({detail.renewal_quote.stato})
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            ) : null}
            {detail.renewed_policy ? (
              <div>
                <p className="text-xs font-semibold text-slate-500">Nuova polizza (rinnovo completato)</p>
                <Link
                  to={`/polizze/${detail.renewed_policy.id}`}
                  className="mt-1 inline-flex items-center gap-1 font-medium text-emerald-800 hover:underline"
                >
                  {detail.renewed_policy.numero}
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold text-slate-500">Cronologia</p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-slate-700">
                {detail.timeline.length === 0 ? (
                  <li className="text-slate-500">Nessun evento registrato.</li>
                ) : (
                  detail.timeline.map((ev, i) => (
                    <li key={i} className="border-l-2 border-slate-200 pl-3 text-xs">
                      <span className="font-medium text-slate-800">
                        {(ev.label as string) || (ev.azione as string) || 'Evento'}
                      </span>
                      {ev.created_at ? (
                        <span className="ml-2 text-slate-500">{formatDate(String(ev.created_at))}</span>
                      ) : null}
                      {ev.dettaglio ? <p className="mt-0.5 text-slate-600">{String(ev.dettaglio)}</p> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={renewalTarget != null}
        onClose={() => {
          setRenewalTarget(null);
          setRenewalPrivacy(false);
        }}
        title="Crea preventivo di rinnovo"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Verrà creato un nuovo preventivo collegato a questa scadenza, con dati precompilati dalla polizza
            attuale. Lo stato della scadenza passerà a «Preventivo rinnovo creato» fino all’emissione della nuova
            polizza.
          </p>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={renewalPrivacy}
              onChange={(e) => setRenewalPrivacy(e.target.checked)}
              className="mt-1"
            />
            <span>
              Dichiaro di aver letto l’informativa privacy e acconsento al trattamento dei dati necessari per la
              nuova pratica.
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setRenewalTarget(null);
                setRenewalPrivacy(false);
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={!renewalPrivacy || renewalSubmitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              onClick={() => void submitRenewal()}
            >
              {renewalSubmitting ? 'Creazione…' : 'Crea preventivo'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={nonRinnovataTarget != null}
        onClose={() => setNonRinnovataTarget(null)}
        title="Segna come non rinnovata"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>La scadenza resterà visibile nei filtri e nello storico, ma non comparirà tra «Da rinnovare».</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setNonRinnovataTarget(null)}
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={nonRinnovataSubmitting}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              onClick={() => void submitNonRinnovata()}
            >
              {nonRinnovataSubmitting ? 'Salvataggio…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={manualRinnovataTarget != null}
        onClose={() => {
          setManualRinnovataTarget(null);
          setManualRinnovataPolicyId('');
        }}
        title="Segna come rinnovata (manuale)"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Uso eccezionale: registra la scadenza come rinnovata senza passare dal flusso automatico. L’operazione è
            tracciata nei log.
          </p>
          <div>
            <label htmlFor="manual-ren-pol" className="mb-1 block text-xs font-medium text-slate-500">
              ID polizza emessa collegata (facoltativo)
            </label>
            <input
              id="manual-ren-pol"
              type="text"
              inputMode="numeric"
              value={manualRinnovataPolicyId}
              onChange={(e) => setManualRinnovataPolicyId(e.target.value)}
              className={tf}
              placeholder="es. 42"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setManualRinnovataTarget(null);
                setManualRinnovataPolicyId('');
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={manualRinnovataSubmitting}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              onClick={() => void submitManualRinnovata()}
            >
              {manualRinnovataSubmitting ? 'Salvataggio…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
