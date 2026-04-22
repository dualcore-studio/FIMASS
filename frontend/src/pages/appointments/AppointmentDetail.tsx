import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../utils/api';
import type { Appointment, AppointmentHistoryEntry } from '../../types';
import { getUserDisplayName, formatDate, formatDateTime, isValidAssistitoPhone, isValidContactEmail } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import AppointmentRowActions from '../../components/appointments/AppointmentRowActions';
import { modalitaLabel } from '../../utils/appointmentLabels';
import { strutturaCanEditTable } from '../../utils/appointmentLabels';

type Detail = Appointment & { history: AppointmentHistoryEntry[] };

type SupplierOption = { id: number; nome: string | null; cognome: string | null };

export default function AppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const role = user?.role;
  const modifica = searchParams.get('modifica') === '1';

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [form, setForm] = useState<Partial<Appointment>>({});

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await api.get<Detail>(`/appointments/${id}`);
      setDetail(data);
      setForm(data);
    } catch (e) {
      setDetail(null);
      setError(e instanceof ApiError ? e.message : 'Errore di caricamento');
    }
  }, [id]);

  useEffect(() => {
    if (user?.role === 'fornitore' || user?.role === 'struttura') return;
    fetchDetail();
  }, [fetchDetail, user?.role]);

  useEffect(() => {
    if (authLoading || role !== 'fornitore' || !id) return;
    navigate(`/appuntamenti?focusAppointment=${encodeURIComponent(id)}&vista=calendario`, { replace: true });
  }, [authLoading, role, id, navigate]);

  useEffect(() => {
    if (authLoading || role !== 'struttura' || !id) return;
    navigate(`/appuntamenti?focusStrutturaAppointment=${encodeURIComponent(id)}`, { replace: true });
  }, [authLoading, role, id, navigate]);

  useEffect(() => {
    if (role === 'struttura' || role === 'admin' || role === 'supervisore') {
      api.get<SupplierOption[]>('/users/suppliers').then(setSuppliers).catch(() => {});
    }
  }, [role]);

  const canEdit =
    detail &&
    ((role === 'struttura' && strutturaCanEditTable(detail.stato) && Number(detail.struttura_id) === Number(user?.id)) ||
      role === 'admin' ||
      role === 'supervisore');

  const showEdit = modifica && canEdit;

  const handleSave = async () => {
    if (!id || !detail) return;
    if (!isValidAssistitoPhone(String(form.assistito_telefono ?? ''))) {
      setError('Inserire un telefono assistito valido (almeno 5 cifre).');
      return;
    }
    if (!isValidContactEmail(String(form.assistito_email ?? ''))) {
      setError('Inserire un’email assistito valida.');
      return;
    }
    if (form.modalita === 'presenza' && !String(form.luogo ?? '').trim()) {
      setError('Indicare il luogo per l’appuntamento in presenza.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        assistito_nome: form.assistito_nome,
        assistito_cognome: form.assistito_cognome,
        assistito_telefono: String(form.assistito_telefono ?? '').trim(),
        assistito_email: String(form.assistito_email ?? '').trim(),
        modalita: form.modalita,
        oggetto: form.oggetto,
        note: form.note != null ? form.note : null,
        data_appuntamento: form.data_appuntamento,
        ora_inizio: form.ora_inizio,
        durata_minuti: form.durata_minuti,
        luogo: form.luogo,
        link_videocall: form.link_videocall,
        numero_telefonico_riferimento: form.modalita === 'telefonata' ? null : form.numero_telefonico_riferimento,
      };
      if (role === 'admin' || role === 'supervisore') {
        if (form.fornitore_id != null) payload.fornitore_id = form.fornitore_id;
      }
      await api.put(`/appointments/${id}`, payload);
      setSearchParams({}, { replace: true });
      await fetchDetail();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="px-4 py-8 text-slate-600">
        <p>Caricamento…</p>
      </div>
    );
  }

  if (role === 'fornitore' || role === 'struttura') {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-600">
        <p>Apertura in agenda…</p>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-700">{error}</p>
        <Link to="/appuntamenti" className="mt-4 inline-block text-sm text-slate-700 underline">
          Torna all&apos;elenco
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="px-4 py-8 text-slate-600">
        <p>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/appuntamenti" className="text-sm text-slate-600 hover:underline">
            ← Appuntamenti
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Appuntamento #{detail.id}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge stato={detail.stato} type="appointment" />
          {canEdit && !modifica ? (
            <button
              type="button"
              onClick={() => setSearchParams({ modifica: '1' }, { replace: true })}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Modifica dati
            </button>
          ) : null}
          <AppointmentRowActions
            row={detail}
            onRefresh={fetchDetail}
            onError={setError}
            onSuccess={() => fetchDetail()}
            onNavigateDetail={(x) => navigate(`/appuntamenti/${x}`)}
            suppliers={suppliers}
            hideOpenInMenu
            showInlineDelete
            onAfterDelete={() => navigate('/appuntamenti')}
          />
        </div>
      </div>
      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      {showEdit ? (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-800">Modifica</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(role === 'admin' || role === 'supervisore') && (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-600">Broker</label>
                <select
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={form.fornitore_id != null ? String(form.fornitore_id) : ''}
                  onChange={(e) => setForm((f) => ({ ...f, fornitore_id: Number(e.target.value) }))}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {[s.nome, s.cognome].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-600">Oggetto</label>
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={form.oggetto || ''}
                onChange={(e) => setForm((f) => ({ ...f, oggetto: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Modalità</label>
              <select
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={form.modalita || 'presenza'}
                onChange={(e) => setForm((f) => ({ ...f, modalita: e.target.value as Appointment['modalita'] }))}
              >
                <option value="presenza">In presenza</option>
                <option value="videocall">Videocall</option>
                <option value="telefonata">Telefonata</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600">Data</label>
              <input
                type="date"
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={String(form.data_appuntamento || '').slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, data_appuntamento: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Ora</label>
              <input
                type="time"
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={form.ora_inizio || ''}
                onChange={(e) => setForm((f) => ({ ...f, ora_inizio: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Durata (min)</label>
              <select
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={String(form.durata_minuti ?? 60)}
                onChange={(e) => setForm((f) => ({ ...f, durata_minuti: Number(e.target.value) as 30 | 60 }))}
              >
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
            {form.modalita === 'presenza' ? (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-600">Luogo</label>
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={form.luogo || ''}
                  onChange={(e) => setForm((f) => ({ ...f, luogo: e.target.value }))}
                />
              </div>
            ) : null}
            {form.modalita === 'videocall' ? (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-600">Link videocall</label>
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={form.link_videocall || ''}
                  onChange={(e) => setForm((f) => ({ ...f, link_videocall: e.target.value }))}
                />
              </div>
            ) : null}
            <div>
              <label className="text-xs font-medium text-slate-700">Assistito nome</label>
              <input
                className="input-field mt-1 text-sm"
                value={form.assistito_nome || ''}
                onChange={(e) => setForm((f) => ({ ...f, assistito_nome: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Assistito cognome</label>
              <input
                className="input-field mt-1 text-sm"
                value={form.assistito_cognome || ''}
                onChange={(e) => setForm((f) => ({ ...f, assistito_cognome: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Telefono assistito *</label>
              <input
                type="tel"
                className="input-field mt-1 text-sm"
                value={form.assistito_telefono || ''}
                onChange={(e) => setForm((f) => ({ ...f, assistito_telefono: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Email assistito *</label>
              <input
                type="email"
                className="input-field mt-1 text-sm"
                value={form.assistito_email || ''}
                onChange={(e) => setForm((f) => ({ ...f, assistito_email: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Note</label>
              <textarea
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                rows={3}
                value={form.note || ''}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setSearchParams({}, { replace: true })} disabled={saving}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-slate-800">Dati appuntamento</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Data e ora</dt>
              <dd className="text-right text-slate-900">
                {formatDate(detail.data_appuntamento)} {detail.ora_inizio} – {detail.ora_fine} ({detail.durata_minuti} min)
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Oggetto</dt>
              <dd className="text-right text-slate-900">{detail.oggetto}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Broker</dt>
              <dd className="text-right text-slate-900">{detail.fornitore ? getUserDisplayName(detail.fornitore) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Struttura</dt>
              <dd className="text-right text-slate-900">{detail.struttura ? getUserDisplayName(detail.struttura) : '—'}</dd>
            </div>
            {detail.motivo_riprogrammazione ? (
              <div className="pt-2">
                <dt className="text-slate-500">Motivo riprogrammazione</dt>
                <dd className="mt-0.5 text-slate-900">{detail.motivo_riprogrammazione}</dd>
              </div>
            ) : null}
            {detail.motivo_annullamento ? (
              <div className="pt-2">
                <dt className="text-slate-500">Motivo annullamento</dt>
                <dd className="mt-0.5 text-slate-900">{detail.motivo_annullamento}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold text-slate-800">Dati assistito</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Nome</dt>
              <dd className="text-right">{detail.assistito_nome}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cognome</dt>
              <dd className="text-right">{detail.assistito_cognome}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Telefono</dt>
              <dd className="text-right">{detail.assistito_telefono || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-right break-all">{detail.assistito_email || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Modalità e riferimenti</h2>
          <p className="mt-1 text-sm text-slate-700">{modalitaLabel(detail.modalita)}</p>
          {detail.modalita === 'presenza' && detail.luogo ? <p className="mt-1 text-sm">Luogo: {detail.luogo}</p> : null}
          {detail.modalita === 'videocall' && detail.link_videocall ? (
            <p className="mt-1 text-sm break-all">
              Link: <a href={detail.link_videocall} className="text-blue-700 underline" target="_blank" rel="noreferrer">{detail.link_videocall}</a>
            </p>
          ) : null}
          {detail.modalita === 'telefonata' && detail.assistito_telefono ? (
            <p className="mt-1 text-sm">Telefono assistito: {detail.assistito_telefono}</p>
          ) : null}
          {detail.note ? (
            <div className="mt-3">
              <h3 className="text-xs font-medium text-slate-500">Note</h3>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{detail.note}</p>
            </div>
          ) : null}
        </section>

        <section className="card p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Storico stati</h2>
          {detail.history && detail.history.length > 0 ? (
            <ul className="mt-2 max-h-80 space-y-3 overflow-y-auto text-sm">
              {detail.history.map((h) => (
                <li key={h.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {h.stato_precedente ? <StatusBadge stato={h.stato_precedente} type="appointment" /> : null}
                    {h.stato_precedente ? <span className="text-slate-400">→</span> : null}
                    <StatusBadge stato={h.stato_nuovo} type="appointment" />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {h.utente ? getUserDisplayName(h.utente) : '—'} · {formatDateTime(h.created_at)}
                  </p>
                  {h.nota ? <p className="mt-1 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-slate-800">{h.nota}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Nessun record.</p>
          )}
        </section>
      </div>
    </div>
  );
}
