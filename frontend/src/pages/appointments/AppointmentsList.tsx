import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Calendar, LayoutList } from 'lucide-react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { api, ApiError } from '../../utils/api';
import type { Appointment, PaginatedResponse, StructureOption } from '../../types';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import TablePagination from '../../components/common/TablePagination';
import Modal from '../../components/ui/Modal';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import AppointmentRowActions from '../../components/appointments/AppointmentRowActions';
import AppointmentFornitoreOverviewModal from '../../components/appointments/AppointmentFornitoreOverviewModal';
import AppointmentStrutturaOverviewModal from '../../components/appointments/AppointmentStrutturaOverviewModal';
import AppointmentStrutturaEditModal from '../../components/appointments/AppointmentStrutturaEditModal';
import AppointmentsMonthCalendar from '../../components/appointments/AppointmentsMonthCalendar';
import { parseMonthKey } from '../../utils/appointmentCalendarMonth';
import { modalitaBadgeClass, modalitaLabel } from '../../utils/appointmentLabels';
import { getUserDisplayName, formatDate, isValidAssistitoPhone, isValidContactEmail } from '../../utils/helpers';
import {
  APPUNTAMENTO_PRESENZA_SLOT_ORARI,
  dataIsoIsThursday,
  validatePresenzaAppointmentClient,
} from '../../utils/appointmentPresenzaSlots';
import PresenzaThursdayDatePicker from '../../components/appointments/PresenzaThursdayDatePicker';

const STATI = ['RICHIESTO', 'CONFERMATO', 'DA RIPROGRAMMARE', 'COMPLETATO', 'ANNULLATO'] as const;
const CAL_LIMIT = 500;

function monthRangeFromKey(m: string) {
  const a = parseMonthKey(m);
  return {
    dataDa: format(startOfMonth(a), 'yyyy-MM-dd'),
    dataAl: format(endOfMonth(a), 'yyyy-MM-dd'),
  };
}

function buildQuery(params: {
  page: number;
  limit?: number;
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
  qs.set('limit', String(params.limit ?? TABLE_PAGE_SIZE));
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
    <div className="flex min-w-[9rem] flex-1 flex-col gap-px">
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
  const [dataDa, setDataDa] = useState(() => {
    const d = searchParams.get('data_da') ?? '';
    const m = searchParams.get('mese');
    if (d || !m || !/^\d{4}-\d{2}$/.test(m)) return d;
    return monthRangeFromKey(m).dataDa;
  });
  const [dataAl, setDataAl] = useState(() => {
    const d = searchParams.get('data_a') ?? '';
    const m = searchParams.get('mese');
    if (d || !m || !/^\d{4}-\d{2}$/.test(m)) return d;
    return monthRangeFromKey(m).dataAl;
  });
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
    durata_minuti: 30 as 30 | 60,
    assistito_nome: '',
    assistito_cognome: '',
    assistito_telefono: '',
    assistito_email: '',
    luogo: '',
    note: '',
  });

  /** Vista predefinita: calendario (solo esplicito `vista=tabella` mostra la tabella). */
  const viewCalendar = searchParams.get('vista') !== 'tabella';
  const meseParam = searchParams.get('mese') ?? '';
  const calInitRef = useRef(false);
  const fornitoreModalIdRef = useRef<number | null>(null);
  const consultationModalIdRef = useRef<number | null>(null);

  const [fornitoreDetailAppt, setFornitoreDetailAppt] = useState<Appointment | null>(null);
  const [consultationDetailAppt, setConsultationDetailAppt] = useState<Appointment | null>(null);
  const [strutturaEditing, setStrutturaEditing] = useState<Appointment | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedAssistito(assistitoInput), 350);
    return () => window.clearTimeout(t);
  }, [assistitoInput]);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedOggetto(oggettoInput), 350);
    return () => window.clearTimeout(t);
  }, [oggettoInput]);

  useEffect(() => {
    if (role === 'struttura' || role === 'admin' || role === 'supervisore' || role === 'fornitore') {
      api.get<SupplierOption[]>('/users/suppliers').then(setSuppliers).catch(() => {});
    }
    if (role === 'admin' || role === 'supervisore') {
      api.get<StructureOption[]>('/users/structures').then(setStructures).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    if (searchParams.get('vista') === 'tabella') {
      calInitRef.current = false;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!viewCalendar || searchParams.get('mese') || calInitRef.current) {
      return;
    }
    calInitRef.current = true;
    const mk = dataDa && dataDa.length >= 7 ? dataDa.slice(0, 7) : format(new Date(), 'yyyy-MM');
    const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
    setDataDa(d1);
    setDataAl(d2);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('mese', mk);
        sp.set('data_da', d1);
        sp.set('data_a', d2);
        if (sp.get('vista') === 'tabella') sp.set('vista', 'tabella');
        else sp.delete('vista');
        return sp;
      },
      { replace: true },
    );
  }, [searchParams, dataDa, setSearchParams, viewCalendar]);

  const focusRaw = searchParams.get('focusAppointment');
  useEffect(() => {
    if (!focusRaw || role !== 'fornitore') return;
    const n = Number(focusRaw);
    if (!Number.isFinite(n)) return;
    let cancelled = false;
    (async () => {
      try {
        const one = await api.get<Appointment>(`/appointments/${n}`);
        if (cancelled) return;
        setFornitoreDetailAppt(one);
        const mk = String(one.data_appuntamento || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(mk)) {
          const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
          setDataDa(d1);
          setDataAl(d2);
        }
        setSearchParams(
          (prev) => {
            const sp = new URLSearchParams(prev);
            sp.delete('focusAppointment');
            if (/^\d{4}-\d{2}$/.test(mk)) {
              const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
              sp.set('mese', mk);
              sp.set('data_da', d1);
              sp.set('data_a', d2);
            }
            sp.delete('vista');
            return sp;
          },
          { replace: true },
        );
      } catch {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const sp = new URLSearchParams(prev);
              sp.delete('focusAppointment');
              return sp;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusRaw, role, setSearchParams]);

  const focusStrutturaRaw = searchParams.get('focusStrutturaAppointment');
  useEffect(() => {
    if (!focusStrutturaRaw || role !== 'struttura') return;
    const n = Number(focusStrutturaRaw);
    if (!Number.isFinite(n)) return;
    let cancelled = false;
    (async () => {
      try {
        const one = await api.get<Appointment>(`/appointments/${n}`);
        if (cancelled) return;
        setConsultationDetailAppt(one);
        const mk = String(one.data_appuntamento || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(mk)) {
          const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
          setDataDa(d1);
          setDataAl(d2);
        }
        setSearchParams(
          (prev) => {
            const sp = new URLSearchParams(prev);
            sp.delete('focusStrutturaAppointment');
            if (/^\d{4}-\d{2}$/.test(mk)) {
              const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
              sp.set('mese', mk);
              sp.set('data_da', d1);
              sp.set('data_a', d2);
            }
            sp.delete('vista');
            return sp;
          },
          { replace: true },
        );
      } catch {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const sp = new URLSearchParams(prev);
              sp.delete('focusStrutturaAppointment');
              return sp;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusStrutturaRaw, role, setSearchParams]);

  useEffect(() => {
    fornitoreModalIdRef.current = fornitoreDetailAppt?.id ?? null;
  }, [fornitoreDetailAppt?.id]);

  useEffect(() => {
    consultationModalIdRef.current = consultationDetailAppt?.id ?? null;
  }, [consultationDetailAppt?.id]);

  useEffect(() => {
    setPage(1);
  }, [statoFilter, dataDa, dataAl, fornitoreFilter, strutturaFilter, modalitaFilter, debouncedAssistito, debouncedOggetto, viewCalendar, meseParam]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (statoFilter) sp.set('stato', statoFilter);
        else sp.delete('stato');
        if (dataDa) sp.set('data_da', dataDa);
        else sp.delete('data_da');
        if (dataAl) sp.set('data_a', dataAl);
        else sp.delete('data_a');
        if (fornitoreFilter) sp.set('fornitore_id', fornitoreFilter);
        else sp.delete('fornitore_id');
        if (strutturaFilter) sp.set('struttura_id', strutturaFilter);
        else sp.delete('struttura_id');
        if (modalitaFilter) sp.set('modalita', modalitaFilter);
        else sp.delete('modalita');
        if (debouncedAssistito) sp.set('assistito', debouncedAssistito);
        else sp.delete('assistito');
        if (debouncedOggetto) sp.set('oggetto', debouncedOggetto);
        else sp.delete('oggetto');
        if (page > 1) sp.set('page', String(page));
        else sp.delete('page');
        if (viewCalendar) {
          const mkFromRange =
            dataDa && /^\d{4}-\d{2}-\d{2}$/.test(dataDa) ? dataDa.slice(0, 7) : meseParam;
          if (mkFromRange) sp.set('mese', mkFromRange);
        }
        return sp;
      },
      { replace: true },
    );
  }, [
    statoFilter,
    dataDa,
    dataAl,
    fornitoreFilter,
    strutturaFilter,
    modalitaFilter,
    debouncedAssistito,
    debouncedOggetto,
    page,
    meseParam,
    viewCalendar,
    setSearchParams,
  ]);

  const effectiveRange = viewCalendar
    ? monthRangeFromKey(meseParam || format(new Date(), 'yyyy-MM'))
    : { dataDa, dataAl };

  const fetchList = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Appointment>>(
        buildQuery({
          page: viewCalendar ? 1 : page,
          limit: viewCalendar ? CAL_LIMIT : TABLE_PAGE_SIZE,
          stato: statoFilter,
          dataDa: effectiveRange.dataDa,
          dataAl: effectiveRange.dataAl,
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
  }, [
    page,
    statoFilter,
    effectiveRange.dataDa,
    effectiveRange.dataAl,
    fornitoreFilter,
    strutturaFilter,
    modalitaFilter,
    debouncedAssistito,
    debouncedOggetto,
    viewCalendar,
  ]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const refreshOpenAppointmentModals = useCallback(async () => {
    await fetchList();
    const fid = fornitoreModalIdRef.current;
    const sid = consultationModalIdRef.current;
    if (fid) {
      try {
        const one = await api.get<Appointment>(`/appointments/${fid}`);
        setFornitoreDetailAppt(one);
      } catch {
        setFornitoreDetailAppt(null);
      }
    }
    if (sid) {
      try {
        const one = await api.get<Appointment>(`/appointments/${sid}`);
        setConsultationDetailAppt(one);
      } catch {
        setConsultationDetailAppt(null);
      }
    }
  }, [fetchList]);

  const openFornitoreModal = useCallback((a: Appointment) => {
    setFornitoreDetailAppt(a);
  }, []);

  const openConsultationModal = useCallback((a: Appointment) => {
    setConsultationDetailAppt(a);
  }, []);

  const resolveNavigateDetail = useCallback(
    async (apptId: number) => {
      if (role === 'fornitore') {
        const fromList = result?.data.find((x) => x.id === apptId);
        if (fromList) {
          openFornitoreModal(fromList);
          return;
        }
        try {
          const one = await api.get<Appointment>(`/appointments/${apptId}`);
          openFornitoreModal(one);
        } catch (e) {
          setActionError(e instanceof ApiError ? e.message : 'Impossibile aprire l’appuntamento.');
        }
        return;
      }
      if (role === 'struttura' || role === 'admin' || role === 'supervisore') {
        const fromList = result?.data.find((x) => x.id === apptId);
        if (fromList) {
          openConsultationModal(fromList);
          return;
        }
        try {
          const one = await api.get<Appointment>(`/appointments/${apptId}`);
          openConsultationModal(one);
        } catch (e) {
          setActionError(e instanceof ApiError ? e.message : 'Impossibile aprire l’appuntamento.');
        }
        return;
      }
      navigate(`/appuntamenti/${apptId}`);
    },
    [role, navigate, result?.data, openFornitoreModal, openConsultationModal],
  );

  const requestStrutturaEdit = useCallback(
    (editId: number) => {
      const cur = consultationDetailAppt?.id === editId ? consultationDetailAppt : null;
      if (cur) {
        setStrutturaEditing(cur);
        return;
      }
      void (async () => {
        try {
          const one = await api.get<Appointment>(`/appointments/${editId}`);
          setStrutturaEditing(one);
        } catch (e) {
          setActionError(e instanceof ApiError ? e.message : 'Impossibile aprire la modifica.');
        }
      })();
    },
    [consultationDetailAppt],
  );

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const setViewMode = (next: 'tabella' | 'calendario') => {
    if (next === 'calendario') {
      const mk = meseParam || (dataDa && dataDa.length >= 7 ? dataDa.slice(0, 7) : format(new Date(), 'yyyy-MM'));
      const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
      setDataDa(d1);
      setDataAl(d2);
      const sp = new URLSearchParams(searchParams);
      sp.delete('vista');
      sp.set('mese', mk);
      sp.set('data_da', d1);
      sp.set('data_a', d2);
      setPage(1);
      setSearchParams(sp, { replace: true });
    } else {
      const sp = new URLSearchParams(searchParams);
      sp.set('vista', 'tabella');
      sp.delete('mese');
      setSearchParams(sp, { replace: true });
    }
  };

  const handleMonthChange = (mk: string) => {
    const { dataDa: d1, dataAl: d2 } = monthRangeFromKey(mk);
    setDataDa(d1);
    setDataAl(d2);
    const sp = new URLSearchParams(searchParams);
    sp.set('mese', mk);
    sp.set('data_da', d1);
    sp.set('data_a', d2);
    if (viewCalendar) {
      sp.delete('vista');
    }
    setSearchParams(sp, { replace: true });
  };

  const handleCreate = async () => {
    if (!createForm.fornitore_id || !createForm.oggetto.trim() || !createForm.data_appuntamento || !createForm.ora_inizio) {
      setActionError('Compilare broker, oggetto, data e ora.');
      return;
    }
    if (!createForm.assistito_nome.trim() || !createForm.assistito_cognome.trim()) {
      setActionError('Nome e cognome assistito obbligatori.');
      return;
    }
    if (!isValidAssistitoPhone(createForm.assistito_telefono)) {
      setActionError('Inserire un telefono assistito valido (almeno 5 cifre).');
      return;
    }
    if (!isValidContactEmail(createForm.assistito_email)) {
      setActionError('Inserire un’email assistito valida.');
      return;
    }
    if (createForm.modalita === 'presenza' && !createForm.luogo.trim()) {
      setActionError('Indicare il luogo per l’appuntamento in presenza.');
      return;
    }
    const durataInvio = createForm.modalita === 'presenza' ? 30 : createForm.durata_minuti;
    const presenzaValidate = validatePresenzaAppointmentClient(
      createForm.modalita,
      createForm.data_appuntamento,
      createForm.ora_inizio,
      durataInvio,
    );
    if (presenzaValidate) {
      setActionError(presenzaValidate);
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
        durata_minuti: durataInvio,
        assistito_nome: createForm.assistito_nome.trim(),
        assistito_cognome: createForm.assistito_cognome.trim(),
        assistito_telefono: createForm.assistito_telefono.trim(),
        assistito_email: createForm.assistito_email.trim(),
        luogo: createForm.modalita === 'presenza' ? createForm.luogo.trim() : undefined,
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
  const tf = 'input-field h-9 w-full min-w-0 py-1.5 text-sm';
  const modalInput = 'input-field text-sm';
  const calendarItems = result?.data ?? [];
  const monthKeyForCal =
    dataDa && /^\d{4}-\d{2}-\d{2}$/.test(dataDa) ? dataDa.slice(0, 7) : meseParam || format(new Date(), 'yyyy-MM');

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Appuntamenti</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Richieste di consulenza tra strutture e broker.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-slate-200/95 bg-slate-100/90 p-px shadow-sm"
            role="group"
            aria-label="Vista appuntamenti"
          >
            <button
              type="button"
              onClick={() => setViewMode('tabella')}
              aria-label="Vista tabella"
              aria-pressed={!viewCalendar}
              title="Tabella"
              className={`inline-flex size-8 items-center justify-center rounded-[5px] transition ${
                !viewCalendar ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendario')}
              aria-label="Vista calendario"
              aria-pressed={viewCalendar}
              title="Calendario"
              className={`inline-flex size-8 items-center justify-center rounded-[5px] transition ${
                viewCalendar ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </button>
          </div>
          {role === 'struttura' ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary shrink-0 self-start"
            >
              <Plus className="h-4 w-4" />
              Nuovo appuntamento
            </button>
          ) : null}
        </div>
      </header>

      {actionSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {actionSuccess}
          <button type="button" className="ml-2 font-medium text-emerald-800 underline" onClick={() => setActionSuccess(null)}>
            Chiudi
          </button>
        </div>
      ) : null}
      {actionError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div> : null}

      <div className="card px-2.5 py-2 sm:px-3 sm:py-2">
        <div className="flex w-full flex-wrap items-end gap-2">
          {viewCalendar ? (
            <p className="mb-1 w-full text-xs text-slate-500 sm:mb-0 sm:w-auto sm:flex-1">
              Il mese mostrato corrisponde al periodo filtrato; usare le frecce nel calendario per cambiare mese.
            </p>
          ) : null}
        </div>
        <div className="mt-1 flex w-full flex-wrap items-end gap-2">
          <span className="sr-only">Filtri appuntamenti</span>
          <FilterCell id="f-stato" label="Stato">
            <select
              id="f-stato"
              className={tf}
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
          {!viewCalendar ? (
            <>
              <FilterCell id="f-da" label="Data da">
                <input
                  id="f-da"
                  type="date"
                  className={tf}
                  value={dataDa}
                  onChange={(e) => setDataDa(e.target.value)}
                />
              </FilterCell>
              <FilterCell id="f-a" label="Data a">
                <input
                  id="f-a"
                  type="date"
                  className={tf}
                  value={dataAl}
                  onChange={(e) => setDataAl(e.target.value)}
                />
              </FilterCell>
            </>
          ) : null}
          {(role === 'admin' || role === 'supervisore' || role === 'struttura') && suppliers.length > 0 ? (
            <FilterCell id="f-forn" label="Broker">
              <select
                id="f-forn"
                className={tf}
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
                className={tf}
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
              className={tf}
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
              className={tf}
              value={assistitoInput}
              onChange={(e) => setAssistitoInput(e.target.value)}
              placeholder="Cerca…"
            />
          </FilterCell>
          <FilterCell id="f-ogg" label="Oggetto">
            <input
              id="f-ogg"
              className={tf}
              value={oggettoInput}
              onChange={(e) => setOggettoInput(e.target.value)}
              placeholder="Cerca…"
            />
          </FilterCell>
        </div>
      </div>

      {listError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{listError}</div> : null}

      {viewCalendar ? (
        <AppointmentsMonthCalendar
          monthKey={monthKeyForCal}
          items={calendarItems}
          loading={loading}
          onMonthChange={handleMonthChange}
          onSelectAppointment={(a) => {
            if (role === 'fornitore') openFornitoreModal(a);
            else if (role === 'struttura' || role === 'admin' || role === 'supervisore') openConsultationModal(a);
            else navigate(`/appuntamenti/${a.id}`);
          }}
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--ui-primary)] border-t-transparent" />
                  <p className="text-sm text-gray-500">Caricamento appuntamenti…</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="portal-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Data</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Ora</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Assistito</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Broker</th>
                      {(role === 'admin' || role === 'supervisore' || role === 'fornitore') && (
                        <th className="px-4 py-3 font-semibold text-gray-700">Struttura</th>
                      )}
                      <th className="px-4 py-3 font-semibold text-gray-700">Modalità</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Oggetto</th>
                      <th className="w-40 px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!result?.data.length ? (
                      <tr>
                        <td colSpan={colCount} className="px-4 py-12 text-center text-gray-500">
                          Nessun appuntamento.
                        </td>
                      </tr>
                    ) : (
                      result.data.map((a) => (
                        <tr
                          key={a.id}
                          className={`border-b border-slate-100/90 ${
                            role === 'fornitore' ||
                            role === 'struttura' ||
                            role === 'admin' ||
                            role === 'supervisore'
                              ? 'cursor-pointer hover:bg-slate-50/90'
                              : ''
                          }`}
                          onClick={(e) => {
                            if (
                              role !== 'fornitore' &&
                              role !== 'struttura' &&
                              role !== 'admin' &&
                              role !== 'supervisore'
                            )
                              return;
                            const el = e.target as HTMLElement;
                            if (el.closest('button') || el.closest('[data-appt-actions-root]')) return;
                            if (role === 'fornitore') openFornitoreModal(a);
                            else openConsultationModal(a);
                          }}
                        >
                          <td className="px-4 py-3 align-middle">
                            <StatusBadge stato={a.stato} type="appointment" />
                          </td>
                          <td className="px-4 py-3 align-middle tabular-nums text-slate-800">
                            {formatDate(a.data_appuntamento)}
                          </td>
                          <td className="px-4 py-3 align-middle tabular-nums text-slate-800">{a.ora_inizio}</td>
                          <td className="px-4 py-3 align-middle text-slate-800">{assistitoCell(a)}</td>
                          <td className="px-4 py-3 align-middle text-slate-800">
                            {a.fornitore ? getUserDisplayName(a.fornitore) : '—'}
                          </td>
                          {(role === 'admin' || role === 'supervisore' || role === 'fornitore') && (
                            <td className="px-4 py-3 align-middle text-slate-800">
                              {a.struttura ? getUserDisplayName(a.struttura) : '—'}
                            </td>
                          )}
                          <td className="px-4 py-3 align-middle">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${modalitaBadgeClass(a.modalita)}`}
                            >
                              {modalitaLabel(a.modalita)}
                            </span>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 align-middle text-slate-800" title={a.oggetto}>
                            {a.oggetto}
                          </td>
                          <td className="px-4 py-3 align-middle text-right" data-appt-actions-root>
                            <AppointmentRowActions
                              row={a}
                              onRefresh={refreshOpenAppointmentModals}
                              onError={(msg) => {
                                setActionError(msg);
                                setActionSuccess(null);
                              }}
                              onSuccess={(msg) => {
                                setActionSuccess(msg);
                                setActionError(null);
                              }}
                              onNavigateDetail={(id) => void resolveNavigateDetail(id)}
                              suppliers={suppliers}
                              {...(role === 'struttura'
                                ? {
                                    onStrutturaEditRequest: requestStrutturaEdit,
                                  }
                                : {})}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {result && !viewCalendar ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={result.total}
              onPageChange={setPage}
              entityLabel="appuntamenti"
            />
          ) : null}
        </>
      )}

      <Modal isOpen={createOpen} onClose={() => !createBusy && setCreateOpen(false)} title="Nuovo appuntamento" size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 md:items-stretch md:gap-x-4">
            <div className="flex min-h-0 flex-col md:h-full">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dati appuntamento</p>
                <div>
                  <label className="text-sm font-medium text-slate-700">Broker *</label>
                  <select
                    className={`mt-1 ${modalInput} w-full`}
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
                  <label className="text-sm font-medium text-slate-700">Modalità *</label>
                  <select
                    className={`mt-1 ${modalInput} w-full`}
                    value={createForm.modalita}
                    onChange={(e) => {
                      const m = e.target.value as typeof createForm.modalita;
                      setCreateForm((f) => {
                        const dataIso = String(f.data_appuntamento || '').trim().slice(0, 10);
                        const clearDataIfInvalidPresenza =
                          m === 'presenza' && dataIso.length > 0 && !dataIsoIsThursday(dataIso);
                        return {
                          ...f,
                          modalita: m,
                          ...(m === 'presenza' ? { durata_minuti: 30, ora_inizio: '' } : {}),
                          ...(clearDataIfInvalidPresenza ? { data_appuntamento: '' } : {}),
                        };
                      });
                    }}
                  >
                    <option value="presenza">In presenza</option>
                    <option value="videocall">Videocall</option>
                    <option value="telefonata">Telefonata</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Oggetto *</label>
                  <input
                    className={`mt-1 ${modalInput} w-full`}
                    value={createForm.oggetto}
                    onChange={(e) => setCreateForm((f) => ({ ...f, oggetto: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Data *</label>
                    {createForm.modalita === 'presenza' ? (
                      <PresenzaThursdayDatePicker
                        className="mt-1 w-full"
                        value={createForm.data_appuntamento}
                        onChange={(iso) => setCreateForm((f) => ({ ...f, data_appuntamento: iso }))}
                        disabled={createBusy}
                        buttonClassName={modalInput}
                        placeholder="Data"
                      />
                    ) : (
                      <input
                        type="date"
                        className={`mt-1 ${modalInput} w-full`}
                        value={createForm.data_appuntamento}
                        onChange={(e) => setCreateForm((f) => ({ ...f, data_appuntamento: e.target.value }))}
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Ora inizio *</label>
                    {createForm.modalita === 'presenza' ? (
                      <select
                        className={`mt-1 ${modalInput} w-full`}
                        value={createForm.ora_inizio}
                        onChange={(e) => setCreateForm((f) => ({ ...f, ora_inizio: e.target.value }))}
                      >
                        <option value="">Seleziona orario…</option>
                        {APPUNTAMENTO_PRESENZA_SLOT_ORARI.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="time"
                        className={`mt-1 ${modalInput} w-full`}
                        value={createForm.ora_inizio}
                        onChange={(e) => setCreateForm((f) => ({ ...f, ora_inizio: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
                {createForm.modalita !== 'presenza' ? (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Durata</label>
                    <select
                      className={`mt-1 ${modalInput} w-full`}
                      value={createForm.durata_minuti}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, durata_minuti: Number(e.target.value) as 30 | 60 }))
                      }
                    >
                      <option value={30}>30 minuti</option>
                      <option value={60}>60 minuti</option>
                    </select>
                  </div>
                ) : null}
              </div>
              {createForm.modalita === 'presenza' ? (
                <div className="mt-auto space-y-3 pt-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Luogo *</label>
                    <input
                      className={`mt-1 ${modalInput} w-full`}
                      value={createForm.luogo}
                      onChange={(e) => setCreateForm((f) => ({ ...f, luogo: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex min-h-0 flex-col md:h-full">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dati assistito</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Nome *</label>
                    <input
                      className={`mt-1 ${modalInput} w-full`}
                      value={createForm.assistito_nome}
                      onChange={(e) => setCreateForm((f) => ({ ...f, assistito_nome: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Cognome *</label>
                    <input
                      className={`mt-1 ${modalInput} w-full`}
                      value={createForm.assistito_cognome}
                      onChange={(e) => setCreateForm((f) => ({ ...f, assistito_cognome: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Telefono assistito *</label>
                  <input
                    type="tel"
                    className={`mt-1 ${modalInput} w-full`}
                    value={createForm.assistito_telefono}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assistito_telefono: e.target.value }))}
                    autoComplete="tel"
                  />
                  {createForm.modalita === 'telefonata' ? (
                    <p className="mt-1 text-xs text-slate-500">Per la telefonata si userà questo numero.</p>
                  ) : null}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email assistito *</label>
                  <input
                    type="email"
                    className={`mt-1 ${modalInput} w-full`}
                    value={createForm.assistito_email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assistito_email: e.target.value }))}
                    autoComplete="email"
                  />
                </div>
                {createForm.modalita !== 'presenza' ? (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Note</label>
                    <textarea
                      className={`mt-1 ${modalInput} min-h-[6.75rem] w-full resize-none`}
                      rows={4}
                      value={createForm.note}
                      onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                ) : null}
              </div>
              {createForm.modalita === 'presenza' ? (
                <div className="mt-auto space-y-3 pt-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Note</label>
                    <textarea
                      className={`mt-1 ${modalInput} min-h-[6.75rem] w-full resize-none`}
                      rows={4}
                      value={createForm.note}
                      onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
          <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)} disabled={createBusy}>
            Annulla
          </button>
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={createBusy}>
            {createBusy ? 'Salvataggio…' : 'Crea richiesta'}
          </button>
        </div>
      </Modal>

      {role === 'fornitore' ? (
        <AppointmentFornitoreOverviewModal
          appointment={fornitoreDetailAppt}
          onClose={() => setFornitoreDetailAppt(null)}
          onRefresh={refreshOpenAppointmentModals}
          onError={(msg) => {
            setActionError(msg);
            setActionSuccess(null);
          }}
          onSuccess={(msg) => {
            setActionSuccess(msg);
            setActionError(null);
          }}
          suppliers={suppliers}
        />
      ) : null}

      {role === 'struttura' || role === 'admin' || role === 'supervisore' ? (
        <AppointmentStrutturaOverviewModal
          appointment={consultationDetailAppt}
          onClose={() => setConsultationDetailAppt(null)}
          onRefresh={refreshOpenAppointmentModals}
          onError={(msg) => {
            setActionError(msg);
            setActionSuccess(null);
          }}
          onSuccess={(msg) => {
            setActionSuccess(msg);
            setActionError(null);
          }}
          suppliers={suppliers}
          {...(role === 'struttura' ? { onStrutturaEditRequest: requestStrutturaEdit } : {})}
        />
      ) : null}

      {role === 'struttura' ? (
        <AppointmentStrutturaEditModal
          appointment={strutturaEditing}
          onClose={() => setStrutturaEditing(null)}
          onSaved={() => {
            void refreshOpenAppointmentModals();
            setActionSuccess('Modifiche salvate.');
            setActionError(null);
          }}
        />
      ) : null}
    </div>
  );
}
