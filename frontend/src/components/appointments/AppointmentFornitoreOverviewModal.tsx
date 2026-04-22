import type { Appointment } from '../../types';
import Modal from '../ui/Modal';
import StatusBadge from '../common/StatusBadge';
import { getUserDisplayName } from '../../utils/helpers';
import { modalitaBadgeClass, modalitaLabel } from '../../utils/appointmentLabels';
import AppointmentRowActions from './AppointmentRowActions';

type SupplierOption = { id: number; nome: string | null; cognome: string | null };

type Props = {
  appointment: Appointment | null;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  suppliers: SupplierOption[];
};

export default function AppointmentFornitoreOverviewModal({
  appointment,
  onClose,
  onRefresh,
  onError,
  onSuccess,
  suppliers,
}: Props) {
  const open = Boolean(appointment);

  return (
    <Modal isOpen={open} onClose={onClose} title="Dettaglio appuntamento" size="lg">
      {appointment ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/90 pb-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge stato={appointment.stato} type="appointment" />
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${modalitaBadgeClass(appointment.modalita)}`}
                >
                  {modalitaLabel(appointment.modalita)}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">{appointment.oggetto}</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Data</dt>
                  <dd className="mt-0.5 tabular-nums text-slate-900">{String(appointment.data_appuntamento || '').slice(0, 10)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Ora</dt>
                  <dd className="mt-0.5 tabular-nums text-slate-900">
                    {appointment.ora_inizio}
                    {appointment.ora_fine ? ` – ${appointment.ora_fine}` : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Durata</dt>
                  <dd className="mt-0.5 text-slate-900">{appointment.durata_minuti} minuti</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Struttura</dt>
                  <dd className="mt-0.5 text-slate-900">{appointment.struttura ? getUserDisplayName(appointment.struttura) : '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500">Assistito</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {[appointment.assistito_nome, appointment.assistito_cognome].filter(Boolean).join(' ') || '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="shrink-0">
              <AppointmentRowActions
                row={appointment}
                onRefresh={onRefresh}
                onError={onError}
                onSuccess={onSuccess}
                onNavigateDetail={() => {}}
                suppliers={suppliers}
                hideOpenInMenu
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-sm text-slate-800">
            {appointment.modalita === 'presenza' ? (
              <p>
                <span className="font-medium text-slate-700">Luogo: </span>
                {appointment.luogo?.trim() || '—'}
              </p>
            ) : null}
            {appointment.modalita === 'videocall' ? (
              <p className="break-all">
                <span className="font-medium text-slate-700">Link videocall: </span>
                {appointment.link_videocall ? (
                  <a href={appointment.link_videocall} className="text-[var(--ui-primary)] underline" target="_blank" rel="noreferrer">
                    {appointment.link_videocall}
                  </a>
                ) : (
                  '—'
                )}
              </p>
            ) : null}
            {appointment.modalita === 'telefonata' ? (
              <p>
                <span className="font-medium text-slate-700">Telefono assistito: </span>
                {appointment.assistito_telefono || '—'}
              </p>
            ) : null}
            {appointment.note ? (
              <div className="mt-2 border-t border-slate-200/80 pt-2">
                <p className="text-xs font-medium text-slate-500">Note</p>
                <p className="mt-0.5 whitespace-pre-wrap">{appointment.note}</p>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end border-t border-slate-200/90 pt-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Chiudi
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
