import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { api, ApiError } from '../../utils/api';

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
  onCompleted: () => void | Promise<void>;
  onError: ErrorSetter;
};

export function OperatorElaborataModal({ isOpen, onClose, quoteId, onCompleted, onError }: ElaborataProps) {
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
