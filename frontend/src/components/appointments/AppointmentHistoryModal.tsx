import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';
import Modal from '../ui/Modal';
import StatusBadge from '../common/StatusBadge';

export type AppointmentHistoryRow = {
  id: number;
  stato_precedente: string | null;
  stato_nuovo: string;
  nota: string | null;
  created_at: string;
  utente?: { nome?: string | null; cognome?: string | null; denominazione?: string | null; role?: string } | null;
};

function actorLabel(u: { nome?: string | null; cognome?: string | null; denominazione?: string | null; role?: string } | null | undefined) {
  if (!u) return '—';
  if (u.role === 'struttura' && u.denominazione) return u.denominazione;
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—';
}

type Props = {
  appointmentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onError: (msg: string) => void;
};

export default function AppointmentHistoryModal({ appointmentId, isOpen, onClose, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AppointmentHistoryRow[]>([]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!isOpen || !appointmentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<AppointmentHistoryRow[]>(`/appointments/${appointmentId}/history`);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          onErrorRef.current(e instanceof ApiError ? e.message : 'Errore caricamento storico');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, appointmentId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Storico stati" size="md">
      {loading ? (
        <p className="text-sm text-slate-500">Caricamento…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nessun record.</p>
      ) : (
        <ul className="max-h-[min(60vh,400px)] space-y-4 overflow-y-auto pr-1">
          {rows.map((h) => (
            <li key={h.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                {h.stato_precedente ? <StatusBadge stato={h.stato_precedente} type="appointment" /> : null}
                {h.stato_precedente ? <span className="text-slate-400">→</span> : null}
                <StatusBadge stato={h.stato_nuovo} type="appointment" />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {actorLabel(h.utente)} · {formatDateTime(h.created_at)}
              </p>
              {h.nota ? <p className="mt-2 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-slate-800">{h.nota}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
