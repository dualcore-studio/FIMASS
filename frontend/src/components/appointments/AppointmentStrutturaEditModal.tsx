import { useEffect, useState } from 'react';
import type { Appointment } from '../../types';
import Modal from '../ui/Modal';
import { api, ApiError } from '../../utils/api';
import { isValidAssistitoPhone, isValidContactEmail } from '../../utils/helpers';
import {
  APPUNTAMENTO_PRESENZA_SLOT_ORARI,
  dataIsoIsThursday,
  validatePresenzaAppointmentClient,
} from '../../utils/appointmentPresenzaSlots';
import {
  APPUNTAMENTO_VIDEOCALL_TELEFONATA_SLOT_ORARI,
  dataIsoIsWeekdayMonFri,
  validateVideocallTelefonataAppointmentClient,
} from '../../utils/appointmentVideocallTelefonataSlots';
import WeekdayDatePicker from './WeekdayDatePicker';

type Props = {
  appointment: Appointment | null;
  onClose: () => void;
  onSaved: (a: Appointment) => void;
};

export default function AppointmentStrutturaEditModal({ appointment, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Partial<Appointment>>({});
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (appointment) {
      setForm(appointment);
      setLocalError(null);
    }
  }, [appointment?.id, appointment?.updated_at, appointment]);

  const open = Boolean(appointment);

  const handleSave = async () => {
    if (!appointment) return;
    if (!isValidAssistitoPhone(String(form.assistito_telefono ?? ''))) {
      setLocalError('Inserire un telefono assistito valido (almeno 5 cifre).');
      return;
    }
    if (!isValidContactEmail(String(form.assistito_email ?? ''))) {
      setLocalError('Inserire un’email assistito valida.');
      return;
    }
    if (form.modalita === 'presenza' && !String(form.luogo ?? '').trim()) {
      setLocalError('Indicare il luogo per l’appuntamento in presenza.');
      return;
    }
    const effDurata =
      form.modalita === 'presenza' || form.modalita === 'videocall' || form.modalita === 'telefonata'
        ? 30
        : Number(form.durata_minuti ?? 60);
    const pv = validatePresenzaAppointmentClient(
      String(form.modalita || ''),
      String(form.data_appuntamento || ''),
      String(form.ora_inizio || ''),
      effDurata,
    );
    if (pv) {
      setLocalError(pv);
      return;
    }
    const vt = validateVideocallTelefonataAppointmentClient(
      String(form.modalita || ''),
      String(form.data_appuntamento || ''),
      String(form.ora_inizio || ''),
      effDurata,
    );
    if (vt) {
      setLocalError(vt);
      return;
    }
    setSaving(true);
    setLocalError(null);
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
        durata_minuti: effDurata,
        luogo: form.luogo,
        link_videocall: form.link_videocall,
        numero_telefonico_riferimento: form.modalita === 'telefonata' ? null : form.numero_telefonico_riferimento,
      };
      await api.put(`/appointments/${appointment.id}`, payload);
      const updated = await api.get<Appointment>(`/appointments/${appointment.id}`);
      onSaved(updated);
      onClose();
    } catch (e) {
      setLocalError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={() => !saving && onClose()} title="Modifica appuntamento" size="lg" scrollBody={false}>
      {appointment ? (
        <div className="space-y-4">
          {localError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-600">Oggetto</label>
              <input
                className="input-field mt-0.5 w-full text-sm"
                value={form.oggetto || ''}
                onChange={(e) => setForm((f) => ({ ...f, oggetto: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Modalità</label>
              <select
                className="input-field mt-0.5 w-full text-sm"
                value={form.modalita || 'presenza'}
                onChange={(e) => {
                  const m = e.target.value as Appointment['modalita'];
                  setForm((f) => {
                    const dataIso = String(f.data_appuntamento || '').trim().slice(0, 10);
                    const clearPres = m === 'presenza' && dataIso.length > 0 && !dataIsoIsThursday(dataIso);
                    const clearWk =
                      (m === 'videocall' || m === 'telefonata') &&
                      dataIso.length > 0 &&
                      !dataIsoIsWeekdayMonFri(dataIso);
                    return {
                      ...f,
                      modalita: m,
                      ...(m === 'presenza' ? { durata_minuti: 30 } : {}),
                      ...(m === 'videocall' || m === 'telefonata' ? { durata_minuti: 30 } : {}),
                      ...(clearPres || clearWk ? { data_appuntamento: '' } : {}),
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
              <label className="text-xs text-slate-600">Data</label>
              {form.modalita === 'videocall' || form.modalita === 'telefonata' ? (
                <WeekdayDatePicker
                  className="mt-0.5 w-full"
                  value={String(form.data_appuntamento || '').slice(0, 10)}
                  onChange={(iso) => setForm((f) => ({ ...f, data_appuntamento: iso }))}
                  disabled={saving}
                  buttonClassName="input-field text-sm"
                  placeholder="Data"
                />
              ) : (
                <>
                  <input
                    type="date"
                    className="input-field mt-0.5 w-full text-sm"
                    value={String(form.data_appuntamento || '').slice(0, 10)}
                    onChange={(e) => setForm((f) => ({ ...f, data_appuntamento: e.target.value }))}
                  />
                  {form.modalita === 'presenza' ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">In presenza: solo giovedì.</p>
                  ) : null}
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-600">Ora</label>
              {form.modalita === 'presenza' ? (
                <select
                  className="input-field mt-0.5 w-full text-sm"
                  value={form.ora_inizio || ''}
                  onChange={(e) => setForm((f) => ({ ...f, ora_inizio: e.target.value }))}
                >
                  <option value="">Seleziona…</option>
                  {APPUNTAMENTO_PRESENZA_SLOT_ORARI.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : form.modalita === 'videocall' || form.modalita === 'telefonata' ? (
                <select
                  className="input-field mt-0.5 w-full text-sm"
                  value={form.ora_inizio || ''}
                  onChange={(e) => setForm((f) => ({ ...f, ora_inizio: e.target.value }))}
                >
                  <option value="">Ora</option>
                  {APPUNTAMENTO_VIDEOCALL_TELEFONATA_SLOT_ORARI.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="time"
                  className="input-field mt-0.5 w-full text-sm"
                  value={form.ora_inizio || ''}
                  onChange={(e) => setForm((f) => ({ ...f, ora_inizio: e.target.value }))}
                />
              )}
            </div>
            {form.modalita === 'presenza' ? (
              <div>
                <label className="text-xs text-slate-600">Durata (min)</label>
                <select
                  className="input-field mt-0.5 w-full text-sm"
                  value={String(form.durata_minuti ?? 60)}
                  disabled
                  onChange={(e) => setForm((f) => ({ ...f, durata_minuti: Number(e.target.value) as 30 | 60 }))}
                >
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
            ) : form.modalita === 'videocall' || form.modalita === 'telefonata' ? null : (
              <div>
                <label className="text-xs text-slate-600">Durata (min)</label>
                <select
                  className="input-field mt-0.5 w-full text-sm"
                  value={String(form.durata_minuti ?? 60)}
                  onChange={(e) => setForm((f) => ({ ...f, durata_minuti: Number(e.target.value) as 30 | 60 }))}
                >
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
            )}
            {form.modalita === 'presenza' ? (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-600">Luogo</label>
                <input
                  className="input-field mt-0.5 w-full text-sm"
                  value={form.luogo || ''}
                  onChange={(e) => setForm((f) => ({ ...f, luogo: e.target.value }))}
                />
              </div>
            ) : null}
            {form.modalita === 'videocall' ? (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-600">Link videocall</label>
                <input
                  className="input-field mt-0.5 w-full text-sm"
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
                className="input-field mt-0.5 w-full resize-y text-sm"
                rows={3}
                value={form.note || ''}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
