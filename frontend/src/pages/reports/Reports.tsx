import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
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
  ResponsiveContainer,
} from 'recharts';
import { api, ApiError } from '../../utils/api';
import KPICard from '../../components/common/KPICard';
import TablePagination from '../../components/common/TablePagination';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';

type PeriodPreset = 'oggi' | 'settimana' | 'mese' | 'trimestre' | 'anno' | 'personalizzato';

interface OverviewData {
  totale_preventivi: number;
  totale_polizze: number;
  preventivi_in_lavorazione: number;
  polizze_emesse: number;
  tasso_conversione: number;
}

interface ByTypeRow {
  tipologia: string;
  preventivi: number;
  polizze: number;
}

interface ByStructureRow {
  denominazione: string;
  preventivi: number;
  elaborati: number;
  polizze: number;
}

interface ByOperatorRow {
  operatore: string;
  totali: number;
  in_lavorazione: number;
  elaborati: number;
  standby: number;
}

function getDateRange(preset: PeriodPreset): { da: string; a: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const a = fmt(now);

  switch (preset) {
    case 'oggi':
      return { da: a, a };
    case 'settimana': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { da: fmt(d), a };
    }
    case 'mese': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return { da: fmt(d), a };
    }
    case 'trimestre': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { da: fmt(d), a };
    }
    case 'anno': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { da: fmt(d), a };
    }
    default:
      return { da: '', a: '' };
  }
}

export default function Reports() {
  const [preset, setPreset] = useState<PeriodPreset>('mese');
  const [customDa, setCustomDa] = useState('');
  const [customA, setCustomA] = useState('');

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [byType, setByType] = useState<ByTypeRow[]>([]);
  const [byStructure, setByStructure] = useState<ByStructureRow[]>([]);
  const [byOperator, setByOperator] = useState<ByOperatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageByType, setPageByType] = useState(1);
  const [pageByStructure, setPageByStructure] = useState(1);
  const [pageByOperator, setPageByOperator] = useState(1);

  useEffect(() => {
    setPageByType(1);
    setPageByStructure(1);
    setPageByOperator(1);
  }, [byType, byStructure, byOperator]);

  const typeTotalPages = useMemo(
    () => (byType.length === 0 ? 1 : Math.ceil(byType.length / TABLE_PAGE_SIZE)),
    [byType.length],
  );
  const structureTotalPages = useMemo(
    () => (byStructure.length === 0 ? 1 : Math.ceil(byStructure.length / TABLE_PAGE_SIZE)),
    [byStructure.length],
  );
  const operatorTotalPages = useMemo(
    () => (byOperator.length === 0 ? 1 : Math.ceil(byOperator.length / TABLE_PAGE_SIZE)),
    [byOperator.length],
  );

  useSyncPageToTotalPages(pageByType, byType.length ? typeTotalPages : undefined, setPageByType);
  useSyncPageToTotalPages(
    pageByStructure,
    byStructure.length ? structureTotalPages : undefined,
    setPageByStructure,
  );
  useSyncPageToTotalPages(
    pageByOperator,
    byOperator.length ? operatorTotalPages : undefined,
    setPageByOperator,
  );

  const byTypePage = useMemo(() => {
    const start = (pageByType - 1) * TABLE_PAGE_SIZE;
    return byType.slice(start, start + TABLE_PAGE_SIZE);
  }, [byType, pageByType]);

  const byStructurePage = useMemo(() => {
    const start = (pageByStructure - 1) * TABLE_PAGE_SIZE;
    return byStructure.slice(start, start + TABLE_PAGE_SIZE);
  }, [byStructure, pageByStructure]);

  const byOperatorPage = useMemo(() => {
    const start = (pageByOperator - 1) * TABLE_PAGE_SIZE;
    return byOperator.slice(start, start + TABLE_PAGE_SIZE);
  }, [byOperator, pageByOperator]);

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
    const qs = `data_da=${da}&data_a=${a}`;

    try {
      const [ov, bt, bs, bo] = await Promise.all([
        api.get<OverviewData>(`/reports/overview?${qs}`),
        api.get<ByTypeRow[]>(`/reports/by-type?${qs}`),
        api.get<ByStructureRow[]>(`/reports/by-structure?${qs}`),
        api.get<ByOperatorRow[]>(`/reports/by-operator?${qs}`),
      ]);
      setOverview(ov);
      setByType(bt);
      setByStructure(bs);
      setByOperator(bo);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare i report.');
    } finally {
      setLoading(false);
    }
  }, [getEffectiveDates, preset]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExportCSV = () => {
    const lines: string[] = [];

    lines.push('--- Panoramica ---');
    lines.push('Metrica,Valore');
    if (overview) {
      lines.push(`Totale Preventivi,${overview.totale_preventivi}`);
      lines.push(`Totale Polizze,${overview.totale_polizze}`);
      lines.push(`Preventivi in Lavorazione,${overview.preventivi_in_lavorazione}`);
      lines.push(`Polizze Emesse,${overview.polizze_emesse}`);
      lines.push(`Tasso Conversione,${overview.tasso_conversione}%`);
    }

    lines.push('');
    lines.push('--- Per Tipologia ---');
    lines.push('Tipologia,Preventivi,Polizze');
    byType.forEach((r) => lines.push(`${r.tipologia},${r.preventivi},${r.polizze}`));

    lines.push('');
    lines.push('--- Per Struttura ---');
    lines.push('Struttura,Preventivi,Elaborati,Polizze');
    byStructure.forEach((r) => lines.push(`${r.denominazione},${r.preventivi},${r.elaborati},${r.polizze}`));

    lines.push('');
    lines.push('--- Per Operatore ---');
    lines.push('Operatore,Totali,In Lavorazione,Elaborati,Standby');
    byOperator.forEach((r) => lines.push(`${r.operatore},${r.totali},${r.in_lavorazione},${r.elaborati},${r.standby}`));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_fimass_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const presetLabels: Record<PeriodPreset, string> = {
    oggi: 'Oggi',
    settimana: 'Settimana',
    mese: 'Mese',
    trimestre: 'Trimestre',
    anno: 'Anno',
    personalizzato: 'Personalizzato',
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Report</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Statistiche e analisi delle attività del portale.
          </p>
        </div>
        <button type="button" onClick={handleExportCSV} disabled={loading} className="btn-secondary shrink-0 self-start">
          <Download className="h-4 w-4" />
          Esporta CSV
        </button>
      </header>

      {/* Period filter */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Calendar className="h-4 w-4" />
          Periodo
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="custom-da" className="mb-1 block text-xs font-medium text-gray-500">Da</label>
                <input id="custom-da" type="date" value={customDa} onChange={(e) => setCustomDa(e.target.value)} className="input-field" />
              </div>
              <div>
                <label htmlFor="custom-a" className="mb-1 block text-xs font-medium text-gray-500">A</label>
                <input id="custom-a" type="date" value={customA} onChange={(e) => setCustomA(e.target.value)} className="input-field" />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
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
          {/* KPI Overview */}
          {overview && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KPICard title="Totale Preventivi" value={overview.totale_preventivi} icon={<FileText className="h-5 w-5" />} color="blue" />
              <KPICard title="Totale Polizze" value={overview.totale_polizze} icon={<Shield className="h-5 w-5" />} color="green" />
              <KPICard title="In Lavorazione" value={overview.preventivi_in_lavorazione} icon={<BarChart3 className="h-5 w-5" />} color="amber" />
              <KPICard title="Polizze Emesse" value={overview.polizze_emesse} icon={<Shield className="h-5 w-5" />} color="purple" />
              <KPICard title="Tasso Conversione" value={`${overview.tasso_conversione}%`} icon={<TrendingUp className="h-5 w-5" />} color="green" />
            </div>
          )}

          {/* Chart */}
          {byType.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Preventivi e Polizze per Tipologia
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="tipologia" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="preventivi" name="Preventivi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="polizze" name="Polizze" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* By Type Table */}
          {byType.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Per Tipologia
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Tipologia</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Preventivi</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Polizze</th>
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

          {/* By Structure Table */}
          {byStructure.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Per Struttura
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Struttura</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Preventivi</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Elaborati</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Polizze</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStructurePage.map((r, i) => (
                      <tr key={`${r.denominazione}-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.denominazione}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.preventivi}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.elaborati}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.polizze}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={pageByStructure}
                totalPages={structureTotalPages}
                total={byStructure.length}
                onPageChange={setPageByStructure}
                entityLabel="strutture"
              />
            </div>
          )}

          {/* By Operator Table */}
          {byOperator.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Per Operatore
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Operatore</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Totali</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">In Lavorazione</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Elaborati</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Standby</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byOperatorPage.map((r, i) => (
                      <tr key={`${r.operatore}-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.operatore}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.totali}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.in_lavorazione}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.elaborati}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.standby}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={pageByOperator}
                totalPages={operatorTotalPages}
                total={byOperator.length}
                onPageChange={setPageByOperator}
                entityLabel="operatori"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
