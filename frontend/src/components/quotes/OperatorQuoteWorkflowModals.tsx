import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import { api, ApiError } from '../../utils/api';
import type { Quote } from '../../types';
import { getRcGaranzieSelezionate } from '../../utils/rcAutoGaranzie';

type ErrorSetter = (message: string) => void;

type StandbyProps = {
  isOpen: boolean;
  onClose: () => void;
  quoteId: number;
  onCompleted: () => void | Promise<void>;
  onError: ErrorSetter;
};

export function OperatorStandbyModal({ isOpen, onClose, quoteId, onCompleted, onError }: StandbyProps) {
  const [motivo, setMotivo] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setLocalError(null);
    }
  }, [isOpen, quoteId]);

  const handleConfirm = async () => {
    if (!motivo.trim()) {
      setLocalError('Il motivo è obbligatorio.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await api.put(`/quotes/${quoteId}/status`, { stato: 'STANDBY', motivo: motivo.trim() });
      await onCompleted();
      onClose();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Impossibile mettere in standby.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title="Metti in standby" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Indica la motivazione dello standby. Il testo è obbligatorio e verrà registrato nello storico stati.
        </p>
        <div>
          <label htmlFor="op-standby-motivo" className="mb-1 block text-sm font-medium text-gray-700">
            Motivazione *
          </label>
          <textarea
            id="op-standby-motivo"
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="input-field"
            placeholder="Descrivi il motivo…"
            disabled={submitting}
          />
        </div>
        {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Annulla
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className="btn-primary">
            {submitting ? 'Salvataggio…' : 'Conferma'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type ElaborataProps = {
  isOpen: boolean;
  onClose: () => void;
  quoteId: number;
  /** Se presente (es. da lista o dettaglio), abilita il flusso RC Auto. */
  quote?: Quote | null;
  onCompleted: () => void | Promise<void>;
  onError: ErrorSetter;
};

function parsePriceInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function OperatorRcAutoElaborataModal({
  isOpen,
  onClose,
  quoteId,
  quote,
  onCompleted,
  onError,
}: ElaborataProps & { quote: Quote }) {
  const garanzie = useMemo(() => getRcGaranzieSelezionate(quote.dati_specifici), [quote.dati_specifici]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const init: Record<string, string> = {};
      for (const g of getRcGaranzieSelezionate(quote.dati_specifici)) {
        init[g] = '';
      }
      setPrices(init);
      setNotes('');
      setFile(null);
      setLocalError(null);
    }
  }, [isOpen, quoteId, quote.dati_specifici]);

  const totale = useMemo(() => {
    let s = 0;
    for (const g of garanzie) {
      const n = parsePriceInput(prices[g] ?? '');
      if (n != null) s += n;
    }
    return Math.round(s * 100) / 100;
  }, [garanzie, prices]);

  const handleConfirm = async () => {
    for (const g of garanzie) {
      const n = parsePriceInput(prices[g] ?? '');
      if (n == null) {
        setLocalError(`Indica un prezzo valido (≥ 0) per: ${g}`);
        return;
      }
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      const pricingBreakdown = garanzie.map((g) => ({
        nome: g,
        prezzo: parsePriceInput(prices[g] ?? '') ?? 0,
      }));
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append(
        'payload',
        JSON.stringify({
          pricingBreakdown,
          notes: notes.trim() || null,
        }),
      );
      await api.upload(`/quotes/${quoteId}/elaborazione-rc-auto`, formData);
      await onCompleted();
      onClose();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatItEuro = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title="Elaborazione RC Auto"
      size="lg"
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-600">
          Completa i prezzi per le garanzie richieste dalla struttura. Il sistema genererà il PDF riepilogativo per la
          struttura. L&apos;allegato operatore è facoltativo.
        </p>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Prezzi garanzie selezionate</h4>
          {garanzie.length === 0 ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
              Nessuna garanzia è stata selezionata nella richiesta: conferma per generare il riepilogo con totale zero.
            </p>
          ) : (
            <ul className="space-y-3">
              {garanzie.map((g) => (
                <li
                  key={g}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-gray-900">{g}</span>
                  <div className="relative max-w-[200px]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      €
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0,00"
                      disabled={submitting}
                      value={prices[g] ?? ''}
                      onChange={(e) => setPrices((prev) => ({ ...prev, [g]: e.target.value }))}
                      className="input-field w-full pl-8 text-sm tabular-nums"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="rc-elab-notes" className="mb-1 block text-sm font-medium text-gray-700">
            Note (facoltative, max 1000 caratteri)
          </label>
          <textarea
            id="rc-elab-notes"
            rows={3}
            maxLength={1000}
            disabled={submitting}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field text-sm"
            placeholder="Eventuali annotazioni per la struttura…"
          />
          <p className="mt-1 text-xs text-gray-400">{notes.length}/1000</p>
        </div>

        <div>
          <label htmlFor="rc-elab-file" className="mb-1 block text-sm font-medium text-gray-700">
            File preventivo allegato (facoltativo)
          </label>
          <input
            id="rc-elab-file"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            disabled={submitting}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="input-field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-800">Totale stimato</span>
            <span className="text-lg font-bold tabular-nums text-slate-900">{formatItEuro(totale)}</span>
          </div>
        </div>

        {localError ? <p className="text-sm text-red-600">{localError}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Annulla
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className="btn-success">
            {submitting ? 'Elaborazione…' : 'Conferma elaborazione'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function OperatorElaborataModal({ isOpen, onClose, quoteId, quote, onCompleted, onError }: ElaborataProps) {
  const isRc = quote != null && String(quote.tipo_codice || '').toLowerCase() === 'rc_auto';
  if (isRc && quote) {
    return (
      <OperatorRcAutoElaborataModal
        isOpen={isOpen}
        onClose={onClose}
        quoteId={quoteId}
        quote={quote}
        onCompleted={onCompleted}
        onError={onError}
      />
    );
  }

  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setLocalError(null);
    }
  }, [isOpen, quoteId]);

  const handleConfirm = async () => {
    if (!file) {
      setLocalError('Il file del preventivo elaborato è obbligatorio.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'quote');
      formData.append('entity_id', String(quoteId));
      formData.append('tipo', 'preventivo_elaborato');
      await api.upload('/attachments/upload', formData);
      await api.put(`/quotes/${quoteId}/status`, { stato: 'ELABORATA' });
      await onCompleted();
      onClose();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title="Segna come elaborata" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Carica il file finale del preventivo. Senza allegato non è possibile completare l&apos;elaborazione.
        </p>
        <div>
          <label htmlFor="op-elaborata-file" className="mb-1 block text-sm font-medium text-gray-700">
            File preventivo finale *
          </label>
          <input
            id="op-elaborata-file"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            disabled={submitting}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="input-field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Annulla
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className="btn-success">
            {submitting ? 'Elaborazione…' : 'Conferma'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type InLavorazioneProps = {
  isOpen: boolean;
  onClose: () => void;
  quoteId: number;
  onCompleted: () => void | Promise<void>;
  onError: ErrorSetter;
};

export function OperatorInLavorazioneConfirmModal({
  isOpen,
  onClose,
  quoteId,
  onCompleted,
  onError,
}: InLavorazioneProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await api.put(`/quotes/${quoteId}/status`, { stato: 'IN LAVORAZIONE' });
      await onCompleted();
      onClose();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Impossibile aggiornare lo stato.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title="Porta in lavorazione" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Confermi di voler impostare la pratica nello stato &quot;In lavorazione&quot;?
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Annulla
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className="btn-primary">
            {submitting ? 'Aggiornamento…' : 'Conferma'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
