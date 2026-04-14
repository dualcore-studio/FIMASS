import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Shield,
  Users,
  Building2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api, ApiError } from '../../utils/api';
import KPICard from '../../components/common/KPICard';
import TablePagination from '../../components/common/TablePagination';
import SortableTh from '../../components/common/SortableTh';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import {
  compareNumbers,
  compareStringsCaseInsensitive,
  sortDirectionMultiplier,
} from '../../utils/clientTableSort';
type PeriodPreset =
  | 'oggi'
  | 'ultimi_7'
  | 'ultimi_30'
  | 'mese_corrente'
  | 'mese_precedente'
  | 'personalizzato';

interface OverviewResponse {
  quoteCounts: Record<string, number>;
  policyCounts: Record<string, number>;
  totalQuotes: number;
  totalPolicies: number;
  conversionRate: string;
}

interface ByTypeRow {
  tipologia: string;
  preventivi: number;
  polizze: number;
}

interface PreventiviByStructureRow {
  struttura_id: number;
  struttura: string;
  presentati: number;
  assegnati: number;
  in_lavorazione: number;
  standby: number;
  elaborati: number;
  totale: number;
}

interface PolizzeByStructureRow {
  struttura_id: number;
  struttura: string;
  richieste_presentate: number;
  in_emissione: number;
  emesse: number;
  totale: number;
}

interface UserActivityRow {
  user_id: number;
  nome_utente: string;
  ruolo: string;
  struttura_associata: string;
  preventivi_presi_in_carico: number;
  preventivi_elaborati: number;
  polizze_gestite: number;
  stato_attivita: string;
  totale_attivita: number;
}

interface TimelinePoint {
  data: string;
  conteggio: number;
}

interface TimelineResponse {
  quoteTimeline: TimelinePoint[];
  policyTimeline: TimelinePoint[];
}

function getDateRange(preset: PeriodPreset): { da: string; a: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const a = fmt(now);

  switch (preset) {
    case 'oggi':
      return { da: a, a };
    case 'ultimi_7': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { da: fmt(d), a };
    }
    case 'ultimi_30': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { da: fmt(d), a };
    }
    case 'mese_corrente': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { da: fmt(d), a };
    }
    case 'mese_precedente': {
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastPrev = new Date(firstThisMonth);
      lastPrev.setDate(0);
      const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
      return { da: fmt(firstPrev), a: fmt(lastPrev) };
    }
    default:
      return { da: '', a: '' };
  }
}

function buildReportQuery(da: string, a: string, strutturaId: string, operatoreId: string): string {
  const p = new URLSearchParams();
  if (da && a) {
    p.set('data_da', da);
    p.set('data_a', a);
  }
  if (strutturaId) p.set('struttura_id', strutturaId);
  if (operatoreId) p.set('operatore_id', operatoreId);
  return p.toString();
}

export default function Reports() {
  const [preset, setPreset] = useState<PeriodPreset>('ultimi_30');
  const [customDa, setCustomDa] = useState('');
  const [customA, setCustomA] = useState('');
  const [strutturaId, setStrutturaId] = useState('');
  const [operatoreId, setOperatoreId] = useState('');

  const [structures, setStructures] = useState<{ id: number; denominazione: string }[]>([]);
  const [operators, setOperators] = useState<{ id: number; nome: string; cognome: string }[]>([]);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [byType, setByType] = useState<ByTypeRow[]>([]);
  const [preventiviByStructure, setPreventiviByStructure] = useState<PreventiviByStructureRow[]>([]);
  const [polizzeByStructure, setPolizzeByStructure] = useState<PolizzeByStructureRow[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivityRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageByType, setPageByType] = useState(1);
  const [pagePrevStr, setPagePrevStr] = useState(1);
  const [pagePolStr, setPagePolStr] = useState(1);
  const [pageUsers, setPageUsers] = useState(1);

  const sortByType = useListTableSort();
  const sortPrevStr = useListTableSort();
  const sortPolStr = useListTableSort();
  const sortUsers = useListTableSort();

  useEffect(() => {
    (async () => {
      try {
        const [strRes, opRes] = await Promise.all([
          api.get<{ id: number; denominazione: string }[]>('/users/structures'),
          api.get<{ id: number; nome: string; cognome: string }[]>('/users/operators'),
        ]);
        setStructures(strRes);
        setOperators(opRes);
      } catch {
        /* filtri opzionali */
      }
    })();
  }, []);

  const getEffectiveDates = useCallback(() => {
    if (preset === 'personalizzato') {
      return { da: customDa, a: customA };
    }
    return getDateRange(preset);
  }, [preset, customDa, customA]);

  const fetchReports = useCallback(async () => {
    const { da, a } = getEffectiveDates();
    if (preset === 'personalizzato' && (!da || !a)) return;

    setLoading(true);
    setError(null);
    const qs = buildReportQuery(da, a, strutturaId, operatoreId);

    try {
      const [ov, bt, prevS, polS, ua, tl] = await Promise.all([
        api.get<OverviewResponse>(`/reports/overview?${qs}`),
        api.get<ByTypeRow[]>(`/reports/by-type?${qs}`),
        api.get<PreventiviByStructureRow[]>(`/reports/preventivi-by-structure?${qs}`),
        api.get<PolizzeByStructureRow[]>(`/reports/polizze-by-structure?${qs}`),
        api.get<UserActivityRow[]>(`/reports/user-activity?${qs}`),
        api.get<TimelineResponse>(`/reports/timeline?${qs}`),
      ]);
      setOverview(ov);
      setByType(bt);
      setPreventiviByStructure(prevS);
      setPolizzeByStructure(polS);
      setUserActivity(ua);
      setTimeline(tl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare i report.');
    } finally {
      setLoading(false);
    }
  }, [getEffectiveDates, preset, strutturaId, operatoreId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setPageByType(1);
    setPagePrevStr(1);
    setPagePolStr(1);
    setPageUsers(1);
  }, [byType, preventiviByStructure, polizzeByStructure, userActivity, strutturaId, operatoreId, preset, customDa, customA]);

  const handleSortType = (key: string) => {
    sortByType.requestSort(key);
    setPageByType(1);
  };
  const handleSortPrevStr = (key: string) => {
    sortPrevStr.requestSort(key);
    setPagePrevStr(1);
  };
  const handleSortPolStr = (key: string) => {
    sortPolStr.requestSort(key);
    setPagePolStr(1);
  };
  const handleSortUsers = (key: string) => {
    sortUsers.requestSort(key);
    setPageUsers(1);
  };

  const typeTotalPages = useMemo(
    () => (byType.length === 0 ? 1 : Math.ceil(byType.length / TABLE_PAGE_SIZE)),
    [byType.length],
  );
  const preventiviByStructureActive = useMemo(
    () => preventiviByStructure.filter((r) => r.totale > 0),
    [preventiviByStructure],
  );

  const polizzeByStructureActive = useMemo(
    () => polizzeByStructure.filter((r) => r.totale > 0),
    [polizzeByStructure],
  );

  const userActivityActive = useMemo(
    () => userActivity.filter((r) => r.totale_attivita > 0),
    [userActivity],
  );

  const prevStrTotalPages = useMemo(
    () =>
      preventiviByStructureActive.length === 0
        ? 1
        : Math.ceil(preventiviByStructureActive.length / TABLE_PAGE_SIZE),
    [preventiviByStructureActive.length],
  );
  const polStrTotalPages = useMemo(
    () =>
      polizzeByStructureActive.length === 0 ? 1 : Math.ceil(polizzeByStructureActive.length / TABLE_PAGE_SIZE),
    [polizzeByStructureActive.length],
  );
  const usersTotalPages = useMemo(
    () => (userActivityActive.length === 0 ? 1 : Math.ceil(userActivityActive.length / TABLE_PAGE_SIZE)),
    [userActivityActive.length],
  );

  useSyncPageToTotalPages(pageByType, byType.length ? typeTotalPages : undefined, setPageByType);
  useSyncPageToTotalPages(
    pagePrevStr,
    preventiviByStructureActive.length ? prevStrTotalPages : undefined,
    setPagePrevStr,
  );
  useSyncPageToTotalPages(pagePolStr, polizzeByStructureActive.length ? polStrTotalPages : undefined, setPagePolStr);
  useSyncPageToTotalPages(pageUsers, userActivityActive.length ? usersTotalPages : undefined, setPageUsers);

  const sortedByType = useMemo(() => {
    const arr = [...byType];
    if (!sortByType.sortBy) return arr;
    const m = sortDirectionMultiplier(sortByType.sortDir);
    arr.sort((a, b) => {
      switch (sortByType.sortBy) {
        case 'tipologia':
          return compareStringsCaseInsensitive(a.tipologia, b.tipologia, m);
        case 'preventivi':
          return compareNumbers(a.preventivi, b.preventivi, m);
        case 'polizze':
          return compareNumbers(a.polizze, b.polizze, m);
        default:
          return 0;
      }
    });
    return arr;
  }, [byType, sortByType.sortBy, sortByType.sortDir]);

  const sortedPrevStr = useMemo(() => {
    const arr = [...preventiviByStructureActive];
    if (!sortPrevStr.sortBy) return arr;
    const m = sortDirectionMultiplier(sortPrevStr.sortDir);
    arr.sort((a, b) => {
      const key = sortPrevStr.sortBy;
      if (key === 'struttura') return compareStringsCaseInsensitive(a.struttura, b.struttura, m);
      const nk = key as keyof PreventiviByStructureRow;
      if (typeof a[nk] === 'number' && typeof b[nk] === 'number') {
        return compareNumbers(a[nk] as number, b[nk] as number, m);
      }
      return 0;
    });
    return arr;
  }, [preventiviByStructureActive, sortPrevStr.sortBy, sortPrevStr.sortDir]);

  const sortedPolStr = useMemo(() => {
    const arr = [...polizzeByStructureActive];
    if (!sortPolStr.sortBy) return arr;
    const m = sortDirectionMultiplier(sortPolStr.sortDir);
    arr.sort((a, b) => {
      const key = sortPolStr.sortBy;
      if (key === 'struttura') return compareStringsCaseInsensitive(a.struttura, b.struttura, m);
      const nk = key as keyof PolizzeByStructureRow;
      if (typeof a[nk] === 'number' && typeof b[nk] === 'number') {
        return compareNumbers(a[nk] as number, b[nk] as number, m);
      }
      return 0;
    });
    return arr;
  }, [polizzeByStructureActive, sortPolStr.sortBy, sortPolStr.sortDir]);

  const sortedUsers = useMemo(() => {
    const arr = [...userActivityActive];
    if (!sortUsers.sortBy) return arr;
    const m = sortDirectionMultiplier(sortUsers.sortDir);
    arr.sort((a, b) => {
      switch (sortUsers.sortBy) {
        case 'nome_utente':
          return compareStringsCaseInsensitive(a.nome_utente, b.nome_utente, m);
        case 'ruolo':
          return compareStringsCaseInsensitive(a.ruolo, b.ruolo, m);
        case 'struttura_associata':
          return compareStringsCaseInsensitive(a.struttura_associata, b.struttura_associata, m);
        case 'preventivi_presi_in_carico':
          return compareNumbers(a.preventivi_presi_in_carico, b.preventivi_presi_in_carico, m);
        case 'preventivi_elaborati':
          return compareNumbers(a.preventivi_elaborati, b.preventivi_elaborati, m);
        case 'polizze_gestite':
          return compareNumbers(a.polizze_gestite, b.polizze_gestite, m);
        case 'totale_attivita':
          return compareNumbers(a.totale_attivita, b.totale_attivita, m);
        default:
          return 0;
      }
    });
    return arr;
  }, [userActivityActive, sortUsers.sortBy, sortUsers.sortDir]);

  const byTypePage = useMemo(() => {
    const start = (pageByType - 1) * TABLE_PAGE_SIZE;
    return sortedByType.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedByType, pageByType]);

  const prevStrPage = useMemo(() => {
    const start = (pagePrevStr - 1) * TABLE_PAGE_SIZE;
    return sortedPrevStr.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedPrevStr, pagePrevStr]);

  const polStrPage = useMemo(() => {
    const start = (pagePolStr - 1) * TABLE_PAGE_SIZE;
    return sortedPolStr.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedPolStr, pagePolStr]);

  const usersPage = useMemo(() => {
    const start = (pageUsers - 1) * TABLE_PAGE_SIZE;
    return sortedUsers.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedUsers, pageUsers]);

  const timelineChartData = useMemo(() => {
    if (!timeline) return [];
    const map = new Map<string, { data: string; preventivi: number; polizze: number }>();
    timeline.quoteTimeline.forEach(({ data, conteggio }) => {
      map.set(data, { data, preventivi: conteggio, polizze: 0 });
    });
    timeline.policyTimeline.forEach(({ data, conteggio }) => {
      const ex = map.get(data) ?? { data, preventivi: 0, polizze: 0 };
      ex.polizze = conteggio;
      map.set(data, ex);
    });
    return [...map.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [timeline]);

  const hasAnyData = useMemo(() => {
    if (!overview) return false;
    return overview.totalQuotes > 0 || overview.totalPolicies > 0;
  }, [overview]);

  const exportQueryString = useCallback(() => {
    const { da, a } = getEffectiveDates();
    return buildReportQuery(da, a, strutturaId, operatoreId);
  }, [getEffectiveDates, strutturaId, operatoreId]);

  const handleExportCsvServer = () => {
    const qs = exportQueryString();
    const filename = `report_fimass_${new Date().toISOString().split('T')[0]}.csv`;
    void api.download(`/reports/export?${qs}`, filename);
  };

  const handleExportCsvClient = () => {
    if (!overview) return;
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const line = (cells: (string | number)[]) => cells.map(esc).join(',');

    const lines: string[] = [
      '\uFEFF',
      line(['KPI', 'Valore']),
      line(['Preventivi presentati', overview.quoteCounts.PRESENTATA ?? 0]),
      line(['Preventivi assegnati', overview.quoteCounts.ASSEGNATA ?? 0]),
      line(['Preventivi in lavorazione', overview.quoteCounts['IN LAVORAZIONE'] ?? 0]),
      line(['Preventivi stand-by', overview.quoteCounts.STANDBY ?? 0]),
      line(['Preventivi elaborati', overview.quoteCounts.ELABORATA ?? 0]),
      line(['Polizze richiesta presentata', overview.policyCounts['RICHIESTA PRESENTATA'] ?? 0]),
      line(['Polizze in emissione', overview.policyCounts['IN EMISSIONE'] ?? 0]),
      line(['Polizze emesse', overview.policyCounts.EMESSA ?? 0]),
      '',
      line(['Struttura', 'Presentati', 'Assegnati', 'In lavorazione', 'Stand-by', 'Elaborati', 'Totale']),
      ...preventiviByStructure.map((r) =>
        line([
          r.struttura,
          r.presentati,
          r.assegnati,
          r.in_lavorazione,
          r.standby,
          r.elaborati,
          r.totale,
        ]),
      ),
      '',
      line(['Struttura', 'Richieste', 'In emissione', 'Emesse', 'Totale']),
      ...polizzeByStructure.map((r) =>
        line([r.struttura, r.richieste_presentate, r.in_emissione, r.emesse, r.totale]),
      ),
      '',
      line([
        'Utente',
        'Ruolo',
        'Struttura',
        'Presi in carico',
        'Elaborati',
        'Polizze',
        'Totale attività',
      ]),
      ...userActivity.map((r) =>
        line([
          r.nome_utente,
          r.ruolo,
          r.struttura_associata,
          r.preventivi_presi_in_carico,
          r.preventivi_elaborati,
          r.polizze_gestite,
          r.totale_attivita,
        ]),
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_fimass_client_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const presetLabels: Record<PeriodPreset, string> = {
    oggi: 'Oggi',
    ultimi_7: 'Ultimi 7 giorni',
    ultimi_30: 'Ultimi 30 giorni',
    mese_corrente: 'Questo mese',
    mese_precedente: 'Mese scorso',
    personalizzato: 'Personalizzato',
  };

  const customIncomplete = preset === 'personalizzato' && (!customDa || !customA);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Report</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Monitoraggio preventivi, polizze e attività del portale con dati aggiornati dal sistema.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 self-start">
          <button
            type="button"
            onClick={handleExportCsvServer}
            disabled={loading || customIncomplete}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Esporta CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsvClient}
            disabled={loading || !overview || customIncomplete}
            className="btn-secondary inline-flex items-center gap-2"
            title="Copia locale dei dati già caricati (UTF-8, apribile in Excel)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV (vista corrente)
          </button>
        </div>
      </header>

      {/* Filtri */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Calendar className="h-4 w-4" />
          Filtri
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Intervallo temporale</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(presetLabels) as PeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  preset === p
                    ? 'bg-blue-700 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {presetLabels[p]}
              </button>
            ))}
          </div>
          {preset === 'personalizzato' && (
            <div className="mt-3 flex w-full flex-wrap items-end gap-2 lg:flex-nowrap">
              <div className="min-w-[9rem] flex-1">
                <label htmlFor="custom-da" className="mb-1 block text-xs font-medium text-gray-500">
                  Da
                </label>
                <input
                  id="custom-da"
                  type="date"
                  value={customDa}
                  onChange={(e) => setCustomDa(e.target.value)}
                  className="input-field w-full min-w-0"
                />
              </div>
              <div className="min-w-[9rem] flex-1">
                <label htmlFor="custom-a" className="mb-1 block text-xs font-medium text-gray-500">
                  A
                </label>
                <input
                  id="custom-a"
                  type="date"
                  value={customA}
                  onChange={(e) => setCustomA(e.target.value)}
                  className="input-field w-full min-w-0"
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="filtro-struttura" className="mb-1 block text-xs font-medium text-gray-500">
              Struttura
            </label>
            <select
              id="filtro-struttura"
              value={strutturaId}
              onChange={(e) => setStrutturaId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Tutte le strutture</option>
              {structures.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.denominazione || `Struttura #${s.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-operatore" className="mb-1 block text-xs font-medium text-gray-500">
              Operatore
            </label>
            <select
              id="filtro-operatore"
              value={operatoreId}
              onChange={(e) => setOperatoreId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Tutti gli operatori</option>
              {operators.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {`${o.cognome || ''} ${o.nome || ''}`.trim() || `Operatore #${o.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {customIncomplete ? (
        <div className="card p-8 text-center text-sm text-gray-600">
          Seleziona data inizio e fine per applicare il periodo personalizzato.
        </div>
      ) : loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            <p className="text-sm text-gray-500">Caricamento report…</p>
          </div>
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-700">{error}</div>
      ) : (
        <>
          {!hasAnyData ? (
            <div className="card p-8 text-center text-sm text-gray-600">
              Nessun dato disponibile per i filtri selezionati. Provare un altro intervallo o rimuovere i filtri su
              struttura e operatore.
            </div>
          ) : null}

          {hasAnyData && overview && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Preventivi</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <KPICard
                  title="Presentati"
                  value={overview.quoteCounts.PRESENTATA ?? 0}
                  icon={<FileText className="h-5 w-5" />}
                  color="blue"
                />
                <KPICard
                  title="Assegnati"
                  value={overview.quoteCounts.ASSEGNATA ?? 0}
                  icon={<Users className="h-5 w-5" />}
                  color="slate"
                />
                <KPICard
                  title="In lavorazione"
                  value={overview.quoteCounts['IN LAVORAZIONE'] ?? 0}
                  icon={<BarChart3 className="h-5 w-5" />}
                  color="amber"
                />
                <KPICard
                  title="Stand-by"
                  value={overview.quoteCounts.STANDBY ?? 0}
                  icon={<BarChart3 className="h-5 w-5" />}
                  color="orange"
                />
                <KPICard
                  title="Elaborati"
                  value={overview.quoteCounts.ELABORATA ?? 0}
                  icon={<FileText className="h-5 w-5" />}
                  color="green"
                />
              </div>
              <h2 className="text-sm font-semibold text-gray-700 pt-2">Polizze</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Richieste presentate"
                  value={overview.policyCounts['RICHIESTA PRESENTATA'] ?? 0}
                  icon={<Shield className="h-5 w-5" />}
                  color="blue"
                />
                <KPICard
                  title="In emissione"
                  value={overview.policyCounts['IN EMISSIONE'] ?? 0}
                  icon={<Shield className="h-5 w-5" />}
                  color="amber"
                />
                <KPICard
                  title="Emesse"
                  value={overview.policyCounts.EMESSA ?? 0}
                  icon={<Shield className="h-5 w-5" />}
                  color="green"
                />
                <KPICard
                  title="Tasso conversione"
                  value={`${overview.conversionRate}%`}
                  icon={<BarChart3 className="h-5 w-5" />}
                  color="purple"
                  subtitle="Polizze / preventivi nel periodo"
                />
              </div>
            </div>
          )}

          {hasAnyData && timelineChartData.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Andamento giornaliero (preventivi e polizze creati)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="preventivi" name="Preventivi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="polizze" name="Polizze" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {hasAnyData && byType.some((r) => r.preventivi > 0 || r.polizze > 0) && (
            <div className="card p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Preventivi e polizze (con pratica) per tipologia
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byType.filter((r) => r.preventivi > 0 || r.polizze > 0)}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="tipologia" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={64} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="preventivi" name="Preventivi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="polizze" name="Pratiche con polizza" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {hasAnyData && byType.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Dettaglio per tipologia
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <SortableTh
                        sortKey="tipologia"
                        activeKey={sortByType.sortBy}
                        direction={sortByType.sortDir}
                        onRequestSort={handleSortType}
                      >
                        Tipologia
                      </SortableTh>
                      <SortableTh
                        sortKey="preventivi"
                        activeKey={sortByType.sortBy}
                        direction={sortByType.sortDir}
                        onRequestSort={handleSortType}
                        align="right"
                      >
                        Preventivi
                      </SortableTh>
                      <SortableTh
                        sortKey="polizze"
                        activeKey={sortByType.sortBy}
                        direction={sortByType.sortDir}
                        onRequestSort={handleSortType}
                        align="right"
                      >
                        Con polizza
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {byTypePage.map((r, i) => (
                      <tr key={`${r.tipologia}-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.tipologia}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.preventivi}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.polizze}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={pageByType}
                totalPages={typeTotalPages}
                total={byType.length}
                onPageChange={setPageByType}
                entityLabel="tipologie"
              />
            </div>
          )}

          {hasAnyData && preventiviByStructureActive.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Report preventivi per struttura
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <SortableTh
                        sortKey="struttura"
                        activeKey={sortPrevStr.sortBy}
                        direction={sortPrevStr.sortDir}
                        onRequestSort={handleSortPrevStr}
                      >
                        Struttura
                      </SortableTh>
                      <SortableTh sortKey="presentati" activeKey={sortPrevStr.sortBy} direction={sortPrevStr.sortDir} onRequestSort={handleSortPrevStr} align="right">
                        Presentati
                      </SortableTh>
                      <SortableTh sortKey="assegnati" activeKey={sortPrevStr.sortBy} direction={sortPrevStr.sortDir} onRequestSort={handleSortPrevStr} align="right">
                        Assegnati
                      </SortableTh>
                      <SortableTh sortKey="in_lavorazione" activeKey={sortPrevStr.sortBy} direction={sortPrevStr.sortDir} onRequestSort={handleSortPrevStr} align="right">
                        In lavorazione
                      </SortableTh>
                      <SortableTh sortKey="standby" activeKey={sortPrevStr.sortBy} direction={sortPrevStr.sortDir} onRequestSort={handleSortPrevStr} align="right">
                        Stand-by
                      </SortableTh>
                      <SortableTh sortKey="elaborati" activeKey={sortPrevStr.sortBy} direction={sortPrevStr.sortDir} onRequestSort={handleSortPrevStr} align="right">
                        Elaborati
                      </SortableTh>
                      <SortableTh sortKey="totale" activeKey={sortPrevStr.sortBy} direction={sortPrevStr.sortDir} onRequestSort={handleSortPrevStr} align="right">
                        Totale
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {prevStrPage.map((r, i) => (
                      <tr key={`${r.struttura_id}-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.struttura}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.presentati}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.assegnati}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.in_lavorazione}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.standby}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.elaborati}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={pagePrevStr}
                totalPages={prevStrTotalPages}
                total={preventiviByStructureActive.length}
                onPageChange={setPagePrevStr}
                entityLabel="strutture"
              />
            </div>
          )}

          {hasAnyData && polizzeByStructureActive.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Report polizze per struttura
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <SortableTh
                        sortKey="struttura"
                        activeKey={sortPolStr.sortBy}
                        direction={sortPolStr.sortDir}
                        onRequestSort={handleSortPolStr}
                      >
                        Struttura
                      </SortableTh>
                      <SortableTh sortKey="richieste_presentate" activeKey={sortPolStr.sortBy} direction={sortPolStr.sortDir} onRequestSort={handleSortPolStr} align="right">
                        Richieste presentate
                      </SortableTh>
                      <SortableTh sortKey="in_emissione" activeKey={sortPolStr.sortBy} direction={sortPolStr.sortDir} onRequestSort={handleSortPolStr} align="right">
                        In emissione
                      </SortableTh>
                      <SortableTh sortKey="emesse" activeKey={sortPolStr.sortBy} direction={sortPolStr.sortDir} onRequestSort={handleSortPolStr} align="right">
                        Emesse
                      </SortableTh>
                      <SortableTh sortKey="totale" activeKey={sortPolStr.sortBy} direction={sortPolStr.sortDir} onRequestSort={handleSortPolStr} align="right">
                        Totale
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {polStrPage.map((r, i) => (
                      <tr key={`${r.struttura_id}-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.struttura}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.richieste_presentate}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.in_emissione}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.emesse}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={pagePolStr}
                totalPages={polStrTotalPages}
                total={polizzeByStructureActive.length}
                onPageChange={setPagePolStr}
                entityLabel="strutture"
              />
            </div>
          )}

          {hasAnyData && userActivityActive.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attività per utente
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <SortableTh sortKey="nome_utente" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers}>
                        Nome utente
                      </SortableTh>
                      <SortableTh sortKey="ruolo" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers}>
                        Ruolo
                      </SortableTh>
                      <SortableTh sortKey="struttura_associata" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers}>
                        Struttura associata
                      </SortableTh>
                      <SortableTh sortKey="preventivi_presi_in_carico" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers} align="right">
                        Presi in carico
                      </SortableTh>
                      <SortableTh sortKey="preventivi_elaborati" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers} align="right">
                        Elaborati
                      </SortableTh>
                      <SortableTh sortKey="polizze_gestite" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers} align="right">
                        Polizze gestite
                      </SortableTh>
                      <SortableTh sortKey="totale_attivita" activeKey={sortUsers.sortBy} direction={sortUsers.sortDir} onRequestSort={handleSortUsers} align="right">
                        Totale attività
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {usersPage.map((r, i) => (
                      <tr key={`${r.user_id}-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.nome_utente}</td>
                        <td className="px-4 py-3 text-gray-700">{r.ruolo}</td>
                        <td className="px-4 py-3 text-gray-700">{r.struttura_associata}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.preventivi_presi_in_carico}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.preventivi_elaborati}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.polizze_gestite}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          <span className="font-medium text-gray-900">{r.totale_attivita}</span>
                          <span className="block text-xs text-gray-500">{r.stato_attivita}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={pageUsers}
                totalPages={usersTotalPages}
                total={userActivityActive.length}
                onPageChange={setPageUsers}
                entityLabel="utenti"
              />
            </div>
          )}

          {hasAnyData && userActivity.length > 0 && userActivityActive.length === 0 && (
            <div className="card p-6 text-sm text-gray-600">
              Nessun utente con attività registrata nel periodo selezionato (nessun preventivo o polizza associati a un
              operatore nei filtri correnti).
            </div>
          )}
        </>
      )}
    </div>
  );
}
