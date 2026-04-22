import { useState } from 'react';
import type { Appointment } from '../../types';
import Modal from '../ui/Modal';
import StatusBadge from '../common/StatusBadge';
import { getUserDisplayName, formatDate } from '../../utils/helpers';
import { modalitaBadgeClass, modalitaLabel } from '../../utils/appointmentLabels';
import AppointmentRowActions from './AppointmentRowActions';
import AppointmentHistoryModal from './AppointmentHistoryModal';

type SupplierOption = { id: number; nome: string | null; cognome: string | null };

type Props = {
  appointment: Appointment | null;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  suppliers: SupplierOption[];
  /** Solo lato struttura: apre il modale di modifica senza uscire dall’elenco. */
  onStrutturaEditRequest?: (id: number) => void;
};

function StrutturaDetailBody({
  appointment,
  onClose,
  onRefresh,
  onError,
  onSuccess,
  suppliers,
  onStrutturaEditRequest,
}: Omit<Props, 'appointment'> & { appointment: Appointment }) {
  const [histOpen, setHistOpen] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <header className="space-y-2 border-b border-slate-200/90 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge stato={appointment.stato} type="appointment" />
            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${modalitaBadgeClass(appointment.modalita)}`}>
              {modalitaLabel(appointment.modalita)}
            </span>
          </div>
          <h3 className="text-base font-semibold leading-snug text-slate-900">{appointment.oggetto}</h3>
        </header>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dati appuntamento</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">Data</dt>
              <dd className="mt-0.5 tabular-nums text-slate-900">{formatDate(appointment.data_appuntamento)}</dd>
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
              <dt className="text-xs font-medium text-slate-500">Broker</dt>
              <dd className="mt-0.5 text-slate-900">{appointment.fornitore ? getUserDisplayName(appointment.fornitore) : '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Struttura</dt>
              <dd className="mt-0.5 text-slate-900">{appointment.struttura ? getUserDisplayName(appointment.struttura) : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistito</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Nome</dt>
              <dd className="mt-0.5 text-slate-900">
                {[appointment.assistito_nome, appointment.assistito_cognome].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Telefono</dt>
              <dd className="mt-0.5 tabular-nums text-slate-900">{appointment.assistito_telefono || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Email</dt>
              <dd className="mt-0.5 break-all text-slate-900">{appointment.assistito_email?.trim() || '—'}</dd>
            </div>
          </dl>
        </section>

        {appointment.modalita === 'presenza' ? (
          <div>
            <p className="text-sm font-medium text-slate-700">Luogo</p>
            <p className="mt-1 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-800">{appointment.luogo?.trim() || '—'}</p>
          </div>
        ) : null}

        {appointment.modalita === 'videocall' ? (
          <div>
            <p className="text-sm font-medium text-slate-700">Link videocall</p>
            {appointment.link_videocall?.trim() ? (
              <p className="mt-1 break-all rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-800">
                {appointment.link_videocall}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">—</p>
            )}
          </div>
        ) : null}

        {appointment.modalita === 'telefonata' ? (
          <p className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-800">
            <span className="font-medium text-slate-700">Telefonata </span>
            sul numero assistito indicato sopra.
          </p>
        ) : null}

        {appointment.note?.trim() ? (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Note</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{appointment.note}</p>
          </div>
        ) : null}

        {appointment.motivo_riprogrammazione?.trim() ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2">
            <p className="text-xs font-medium text-amber-900/80">Motivo riprogrammazione</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{appointment.motivo_riprogrammazione}</p>
          </div>
        ) : null}

        {appointment.motivo_annullamento?.trim() ? (
          <div className="rounded-lg border border-red-200/80 bg-red-50/70 px-3 py-2">
            <p className="text-xs font-medium text-red-900/80">Motivo annullamento</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-red-950">{appointment.motivo_annullamento}</p>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200/70 bg-white px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storico stati</p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-[var(--ui-primary)] hover:underline"
            onClick={() => setHistOpen(true)}
          >
            Visualizza storico stati
          </button>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200/90 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <AppointmentRowActions
            row={appointment}
            onRefresh={onRefresh}
            onError={onError}
            onSuccess={onSuccess}
            onNavigateDetail={() => {}}
            suppliers={suppliers}
            hideOpenInMenu
            uiVariant="toolbar"
            historyInActions={false}
            onAfterDelete={() => {
              onSuccess('Appuntamento eliminato.');
              onClose();
              void onRefresh();
            }}
            {...(onStrutturaEditRequest ? { onStrutturaEditRequest } : {})}
          />
          <button type="button" className="btn-secondary shrink-0 self-end sm:self-auto" onClick={onClose}>
            Chiudi
          </button>
        </footer>
      </div>

      <AppointmentHistoryModal appointmentId={appointment.id} isOpen={histOpen} onClose={() => setHistOpen(false)} onError={onError} />
    </>
  );
}

export default function AppointmentStrutturaOverviewModal({
  appointment,
  onClose,
  onRefresh,
  onError,
  onSuccess,
  suppliers,
  onStrutturaEditRequest,
}: Props) {
  const open = Boolean(appointment);

  return (
    <Modal isOpen={open} onClose={onClose} title="Dettaglio appuntamento" size="lg">
      {appointment ? (
        <StrutturaDetailBody
          key={`${appointment.id}-${appointment.updated_at}`}
          appointment={appointment}
          onClose={onClose}
          onRefresh={onRefresh}
          onError={onError}
          onSuccess={onSuccess}
          suppliers={suppliers}
          onStrutturaEditRequest={onStrutturaEditRequest}
        />
      ) : null}
    </Modal>
  );
}
