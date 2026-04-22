import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Appointment, PaginatedResponse, StructureOption } from '../../types';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import TablePagination from '../../components/common/TablePagination';
import Modal from '../../components/ui/Modal';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import AppointmentRowActions from '../../components/appointments/AppointmentRowActions';
import { modalitaLabel, modalitaBadgeClass } from '../../utils/appointmentLabels';
import { getUserDisplayName } from '../../utils/helpers';

const STATI = ['RICHIESTO', 'CONFERMATO', 'DA RIPROGRAMMARE', 'COMPLETATO', 'ANNULLATO'] as const;

function buildQuery(params: {
  page: number;
  stato: string;
  dataDa: string;
  dataAl: string;
  fornitore: string;
  struttura: string;
  modalita: string;
  assistito: string;
  oggetto: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(TABLE_PAGE_SIZE));
  if (params.stato) qs.set('stato', params.stato);
  if (params.dataDa) qs.set('data_da', params.dataDa);
  if (params.dataAl) qs.set('data_a', params.dataAl);
  if (params.fornitore) qs.set('fornitore_id', params.fornitore);
  if (params.struttura) qs.set('struttura_id', params.struttura);
  if (params.modalita) qs.set('modalita', params.modalita);
  if (params.assistito.trim()) qs.set('assistito', params.assistito.trim());
  if (params.oggetto.trim()) qs.set('oggetto', params.oggetto.trim());
  return `/appointments?${qs.toString()}`;
}

function FilterCell({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col gap-px">
      <label htmlFor={id} className="whitespace-nowrap text-[11px] font-normal leading-tight text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

type SupplierOption = { id: number; nome: string | null; cognome: string | null; email?: string; role?: string };

export default function AppointmentsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const role = user?.role;

  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
  const [statoFilter, setStatoFilter] = useState(searchParams.get('stato') ?? '');
  const [dataDa, setDataDa] = useState(searchParams.get('data_da') ?? '');
  const [dataAl, setDataAl] = useState(searchParams.get('data_a') ?? '');
  const [fornitoreFilter, setFornitoreFilter] = useState(searchParams.get('fornitore_id') ?? '');
  const [strutturaFilter, setStrutturaFilter] = useState(searchParams.get('struttura_id') ?? '');
  const [modalitaFilter, setModalitaFilter] = useState(searchParams.get('modalita') ?? '');
  const [assistitoInput, setAssistitoInput] = useState(searchParams.get('assistito') ?? '');
  const [oggettoInput, setOggettoInput] = useState(searchParams.get('oggetto') ?? '');
  const [debouncedAssistito, setDebouncedAssistito] = useState(assistitoInput);
  const [debouncedOggetto, setDebouncedOggetto] = useState(oggettoInput);

  const [result, setResult] = useState<PaginatedResponse<Appointment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [structures, setStructures] = useState<StructureOption[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createForm, setCreateForm] = useState({
    fornitore_id: '',
    modalita: 'presenza' as 'presenza' | 'videocall' | 'telefonata',
    oggetto: '',
    data_appuntamento: '',
    ora_inizio: '',
    durata_minuti: 60 as 30 | 60,
    assistito_nome: '',
    assistito_cognome: '',
    assistito_telefono: '',
    assistito_email: '',
    luogo: '',
    numero_telefonico_riferimento: '',
    note: '',
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedAssistito(assistitoInput), 350);
    return () => window.clearTimeout(t);
  }, [assistitoInput]);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedOggetto(oggettoInput), 350);
    return () => window.clearTimeout(t);
  }, [oggettoInput]);

  useEffect(() => {
    api.get<SupplierOption[]>('/users/suppliers').then(setSuppliers).catch(() => {});
    if (role === 'admin' || role === 'supervisore') {
      api.get<StructureOption[]>('/users/structures').then(setStructures).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    setPage(1);
  }, [statoFilter, dataDa, dataAl, fornitoreFilter, strutturaFilter, modalitaFilter, debouncedAssistito, debouncedOggetto]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (statoFilter) sp.set('stato', statoFilter);
    if (dataDa) sp.set('data_da', dataDa);
    if (dataAl) sp.set('data_a', dataAl);
    if (fornitoreFilter) sp.set('fornitore_id', fornitoreFilter);
    if (strutturaFilter) sp.set('struttura_id', strutturaFilter);
    if (modalitaFilter) sp.set('modalita', modalitaFilter);
    if (debouncedAssistito) sp.set('assistito', debouncedAssistito);
    if (debouncedOggetto) sp.set('oggetto', debouncedOggetto);
    if (page > 1) sp.set('page', String(page));
    setSearchParams(sp, { replace: true });
  }, [statoFilter, dataDa, dataAl, fornitoreFilter, strutturaFilter, modalitaFilter, debouncedAssistito, debouncedOggetto, page, setSearchParams]);

  const fetchList = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Appointment>>(
        buildQuery({
          page,
          stato: statoFilter,
          dataDa,
          dataAl,
          fornitore: fornitoreFilter,
          struttura: strutturaFilter,
          modalita: modalitaFilter,
          assistito: debouncedAssistito,
          oggetto: debouncedOggetto,
        }),
      );
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare gli appuntamenti.');
    } finally {
      setLoading(false);
    }
  }, [page, statoFilter, dataDa, dataAl, fornitoreFilter, strutturaFilter, modalitaFilter, debouncedAssistito, debouncedOggetto]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const handleCreate = async () => {
    if (!createForm.fornitore_id || !createForm.oggetto.trim() || !createForm.data_appuntamento || !createForm.ora_inizio) {
      setActionError('Compilare fornitore, oggetto, data e ora.');
      return;
    }
    if (!createForm.assistito_nome.trim() || !createForm.assistito_cognome.trim()) {
      setActionError('Nome e cognome assistito obbligatori.');
      return;
    }
    setCreateBusy(true);
    setActionError(null);
    try {
      await api.post('/appointments', {
        fornitore_id: Number(createForm.fornitore_id),
        modalita: createForm.modalita,
        oggetto: createForm.oggetto.trim(),
        data_appuntamento: createForm.data_appuntamento,
        ora_inizio: createForm.ora_inizio,
        durata_minuti: createForm.durata_minuti,
        assistito_nome: createForm.assistito_nome.trim(),
        assistito_cognome: createForm.assistito_cognome.trim(),
        assistito_telefono: createForm.assistito_telefono.trim() || undefined,
        assistito_email: createForm.assistito_email.trim() || undefined,
        luogo: createForm.modalita === 'presenza' ? createForm.luogo.trim() : undefined,
        numero_telefonico_riferimento:
          createForm.modalita === 'telefonata' ? createForm.numero_telefonico_riferimento.trim() : undefined,
        note: createForm.note.trim() || undefined,
      });
      setActionSuccess('Appuntamento creato.');
      setCreateOpen(false);
      setCreateForm((f) => ({
        ...f,
        oggetto: '',
        note: '',
        assistito_nome: '',
        assistito_cognome: '',
        assistito_telefono: '',
        assistito_email: '',
        luogo: '',
        numero_telefonico_riferimento: '',
      }));
      fetchList();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Errore creazione');
    } finally {
      setCreateBusy(false);
    }
  };

  const assistitoCell = (a: Appointment) => [a.assistito_nome, a.assistito_cognome].filter(Boolean).join(' ');
  const colCount = role === 'admin' || role === 'supervisore' || role === 'fornitore' ? 9 : 8;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Appuntamenti</h1>
          <p className="text-sm text-slate-600">Richieste di consulenza tra strutture e fornitori</p>
        </div>
        {role === 'struttura' ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Nuovo appuntamento
          </button>
        ) : null}
      </div>

      {actionSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {actionSuccess}
          <button type="button" className="ml-2 underline" onClick={() => setActionSuccess(null)}>
            Chiudi
          </button>
        </div>
      ) : null}
      {actionError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</div> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <FilterCell id="f-stato" label="Stato">
          <select
            id="f-stato"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={statoFilter}
            onChange={(e) => setStatoFilter(e.target.value)}
          >
            <option value="">Tutti</option>
            {STATI.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterCell>
        <FilterCell id="f-da" label="Data da">
          <input id="f-da" type="date" className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={dataDa} onChange={(e) => setDataDa(e.target.value)} />
        </FilterCell>
        <FilterCell id="f-a" label="Data a">
          <input id="f-a" type="date" className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={dataAl} onChange={(e) => setDataAl(e.target.value)} />
        </FilterCell>
        {(role === 'admin' || role === 'supervisore' || role === 'struttura') && suppliers.length > 0 ? (
          <FilterCell id="f-forn" label="Fornitore">
            <select
              id="f-forn"
              className="w-full min-w-[9rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={fornitoreFilter}
              onChange={(e) => setFornitoreFilter(e.target.value)}
            >
              <option value="">Tutti</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.nome, s.cognome].filter(Boolean).join(' ') || `#${s.id}`}
                </option>
              ))}
            </select>
          </FilterCell>
        ) : null}
        {(role === 'admin' || role === 'supervisore') && structures.length > 0 ? (
          <FilterCell id="f-str" label="Struttura">
            <select
              id="f-str"
              className="w-full min-w-[9rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={strutturaFilter}
              onChange={(e) => setStrutturaFilter(e.target.value)}
            >
              <option value="">Tutte</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.denominazione || `Struttura #${s.id}`}
                </option>
              ))}
            </select>
          </FilterCell>
        ) : null}
        <FilterCell id="f-mod" label="Modalità">
          <select
            id="f-mod"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={modalitaFilter}
            onChange={(e) => setModalitaFilter(e.target.value)}
          >
            <option value="">Tutte</option>
            <option value="presenza">In presenza</option>
            <option value="videocall">Videocall</option>
            <option value="telefonata">Telefonata</option>
          </select>
        </FilterCell>
        <FilterCell id="f-ass" label="Assistito">
          <input
            id="f-ass"
            className="w-full min-w-[8rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={assistitoInput}
            onChange={(e) => setAssistitoInput(e.target.value)}
            placeholder="Cerca…"
          />
        </FilterCell>
        <FilterCell id="f-ogg" label="Oggetto">
          <input
            id="f-ogg"
            className="w-full min-w-[8rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={oggettoInput}
            onChange={(e) => setOggettoInput(e.target.value)}
            placeholder="Cerca…"
          />
        </FilterCell>
      </div>

      {listError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{listError}</div> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Ora</th>
              <th className="px-3 py-2">Assistito</th>
              <th className="px-3 py-2">Fornitore</th>
              {(role === 'admin' || role === 'supervisore' || role === 'fornitore') && <th className="px-3 py-2">Struttura</th>}
              <th className="px-3 py-2">Modalità</th>
              <th className="px-3 py-2">Oggetto</th>
              <th className="px-3 py-2 w-40">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-slate-500">
                  Caricamento…
                </td>
              </tr>
            ) : !result?.data.length ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-slate-500">
                  Nessun appuntamento.
                </td>
              </tr>
            ) : (
              result.data.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2 align-middle">
                    <StatusBadge stato={a.stato} type="appointment" />
                  </td>
                  <td className="px-3 py-2 align-middle tabular-nums text-slate-800">{String(a.data_appuntamento || '').slice(0, 10)}</td>
                  <td className="px-3 py-2 align-middle tabular-nums">{a.ora_inizio}</td>
                  <td className="px-3 py-2 align-middle">{assistitoCell(a)}</td>
                  <td className="px-3 py-2 align-middle">
                    {a.fornitore ? getUserDisplayName(a.fornitore) : '—'}
                  </td>
                  {(role === 'admin' || role === 'supervisore' || role === 'fornitore') && (
                    <td className="px-3 py-2 align-middle">{a.struttura ? getUserDisplayName(a.struttura) : '—'}</td>
                  )}
                  <td className="px-3 py-2 align-middle">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${modalitaBadgeClass(a.modalita)}`}>
                      {modalitaLabel(a.modalita)}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 align-middle" title={a.oggetto}>
                    {a.oggetto}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <AppointmentRowActions
                      row={a}
                      onRefresh={fetchList}
                      onError={(msg) => {
                        setActionError(msg);
                        setActionSuccess(null);
                      }}
                      onSuccess={(msg) => {
                        setActionSuccess(msg);
                        setActionError(null);
                      }}
                      onNavigateDetail={(id) => navigate(`/appuntamenti/${id}`)}
                      suppliers={suppliers}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {result ? (
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={result.total}
          onPageChange={setPage}
          entityLabel="appuntamenti"
        />
      ) : null}

      <Modal isOpen={createOpen} onClose={() => !createBusy && setCreateOpen(false)} title="Nuovo appuntamento" size="lg">
        <div className="grid max-h-[min(80vh,640px)] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dati appuntamento</p>
            <div>
              <label className="text-xs text-slate-600">Fornitore *</label>
              <select
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={createForm.fornitore_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, fornitore_id: e.target.value }))}
              >
                <option value="">Seleziona…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {[s.nome, s.cognome].filter(Boolean).join(' ') || `#${s.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600">Modalità *</label>
              <select
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={createForm.modalita}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, modalita: e.target.value as typeof f.modalita }))
                }
              >
                <option value="presenza">In presenza</option>
                <option value="videocall">Videocall</option>
                <option value="telefonata">Telefonata</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600">Oggetto *</label>
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={createForm.oggetto}
                onChange={(e) => setCreateForm((f) => ({ ...f, oggetto: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">Data *</label>
                <input
                  type="date"
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={createForm.data_appuntamento}
                  onChange={(e) => setCreateForm((f) => ({ ...f, data_appuntamento: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Ora inizio *</label>
                <input
                  type="time"
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={createForm.ora_inizio}
                  onChange={(e) => setCreateForm((f) => ({ ...f, ora_inizio: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600">Durata</label>
              <select
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={createForm.durata_minuti}
                onChange={(e) => setCreateForm((f) => ({ ...f, durata_minuti: Number(e.target.value) as 30 | 60 }))}
              >
                <option value={30}>30 minuti</option>
                <option value={60}>60 minuti</option>
              </select>
            </div>
            {createForm.modalita === 'presenza' ? (
              <div>
                <label className="text-xs text-slate-600">Luogo *</label>
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={createForm.luogo}
                  onChange={(e) => setCreateForm((f) => ({ ...f, luogo: e.target.value }))}
                />
              </div>
            ) : null}
            {createForm.modalita === 'telefonata' ? (
              <div>
                <label className="text-xs text-slate-600">Numero telefonico di riferimento *</label>
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={createForm.numero_telefonico_riferimento}
                  onChange={(e) => setCreateForm((f) => ({ ...f, numero_telefonico_riferimento: e.target.value }))}
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dati assistito</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">Nome *</label>
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={createForm.assistito_nome}
                  onChange={(e) => setCreateForm((f) => ({ ...f, assistito_nome: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Cognome *</label>
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={createForm.assistito_cognome}
                  onChange={(e) => setCreateForm((f) => ({ ...f, assistito_cognome: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600">Telefono</label>
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={createForm.assistito_telefono}
                onChange={(e) => setCreateForm((f) => ({ ...f, assistito_telefono: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Email</label>
              <input
                type="email"
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={createForm.assistito_email}
                onChange={(e) => setCreateForm((f) => ({ ...f, assistito_email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Note</label>
              <textarea
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                rows={4}
                value={createForm.note}
                onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setCreateOpen(false)} disabled={createBusy}>
            Annulla
          </button>
          <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" onClick={handleCreate} disabled={createBusy}>
            {createBusy ? 'Salvataggio…' : 'Crea richiesta'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
