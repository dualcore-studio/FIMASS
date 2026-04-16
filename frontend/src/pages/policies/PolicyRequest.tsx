import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Send, Upload } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Quote } from '../../types';
import { formatDate } from '../../utils/helpers';
import StatusBadge from '../../components/common/StatusBadge';
import PolicyPaymentExtremesCard from '../../components/policies/PolicyPaymentExtremesCard';
import Modal from '../../components/ui/Modal';

export default function PolicyRequest() {
  const [searchParams] = useSearchParams();
  const preselectQuoteId = searchParams.get('quote_id');
  const navigate = useNavigate();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalQuote, setModalQuote] = useState<Quote | null>(null);
  const [noteStruttura, setNoteStruttura] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchEligible = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<Quote[]>('/quotes/eligible-for-policy');
      setQuotes(data);
    } catch (e) {
      setQuotes([]);
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare i preventivi idonei.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEligible();
  }, [fetchEligible]);

  useEffect(() => {
    if (!preselectQuoteId || loading || quotes.length === 0) return;
    const id = Number(preselectQuoteId);
    if (Number.isNaN(id)) return;
    const q = quotes.find((row) => Number(row.id) === id);
    if (q) {
      setModalQuote(q);
      setNoteStruttura('');
      setPaymentReceipt(null);
      setSubmitError(null);
    }
  }, [preselectQuoteId, loading, quotes]);

  const closeModal = () => {
    setModalQuote(null);
    setNoteStruttura('');
    setPaymentReceipt(null);
    setSubmitError(null);
  };

  const handleConfirmRequest = async () => {
    if (!modalQuote) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const newPolicy = await api.post<{ id: number }>('/policies', {
        quote_id: Number(modalQuote.id),
        note_struttura: noteStruttura.trim() || null,
      });

      if (paymentReceipt) {
        const formData = new FormData();
        formData.append('file', paymentReceipt);
        formData.append('entity_type', 'policy');
        formData.append('entity_id', String(newPolicy.id));
        formData.append('tipo', 'ricevuta_pagamento');
        await api.upload('/attachments/upload', formData);
      }

      closeModal();
      navigate(`/polizze/${newPolicy.id}`);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Impossibile completare la richiesta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento preventivi elaborati…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-slate-900">Nuova polizza</h1>
          <p className="mt-1 text-sm text-slate-500">
            Seleziona un preventivo <strong className="font-medium text-slate-700">elaborato</strong> per richiedere
            l&apos;emissione della polizza.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {!error && quotes.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-medium text-slate-800">Non ci sono preventivi pronti per l&apos;emissione.</p>
          <p className="mt-2 text-sm text-slate-500">
            Risultano idonei solo i preventivi in stato <strong>ELABORATA</strong> senza una polizza già associata.
          </p>
          <Link to="/preventivi" className="btn-secondary mt-6 inline-flex">
            Vai ai preventivi
          </Link>
        </div>
      ) : null}

      {!error && quotes.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Preventivo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Assistito</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tipologia</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Struttura</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Data elaborazione</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Operatore</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const opLabel = q.operatore_id
                    ? [q.operatore_nome, q.operatore_cognome].filter(Boolean).join(' ') || '—'
                    : '—';
                  return (
                    <tr key={q.id}>
                      <td className="px-4 py-3">
                        <Link
                          to={`/preventivi/${q.id}`}
                          className="font-mono text-xs font-medium text-blue-700 hover:underline"
                        >
                          {q.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {[q.assistito_nome, q.assistito_cognome].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{q.tipo_nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{q.struttura_nome ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(q.updated_at)}</td>
                      <td className="px-4 py-3 text-gray-600">{opLabel}</td>
                      <td className="px-4 py-3">
                        <StatusBadge stato={q.stato} type="quote" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setModalQuote(q);
                            setNoteStruttura('');
                            setPaymentReceipt(null);
                            setSubmitError(null);
                          }}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Richiedi emissione
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Modal
        isOpen={Boolean(modalQuote)}
        onClose={() => !submitting && closeModal()}
        title="Richiedi emissione polizza"
        size="lg"
      >
        {modalQuote ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Preventivo{' '}
              <Link to={`/preventivi/${modalQuote.id}`} className="font-mono font-medium text-blue-700 hover:underline">
                {modalQuote.numero}
              </Link>
              {' — '}
              {[modalQuote.assistito_nome, modalQuote.assistito_cognome].filter(Boolean).join(' ') || 'Assistito'}
            </p>

            <PolicyPaymentExtremesCard
              assistitoNome={modalQuote.assistito_nome}
              assistitoCognome={modalQuote.assistito_cognome}
            />

            <div>
              <label htmlFor="note_polizza" className="mb-1 block text-sm font-medium text-slate-700">
                Note per l&apos;operatore
              </label>
              <textarea
                id="note_polizza"
                rows={4}
                value={noteStruttura}
                onChange={(e) => setNoteStruttura(e.target.value)}
                className="input-field resize-none"
                placeholder="Opzionale: indicazioni o riferimenti utili…"
              />
            </div>

            <div>
              <label htmlFor="ricevuta_polizza" className="mb-1 block text-sm font-medium text-slate-700">
                Ricevuta di pagamento
              </label>
              <input
                id="ricevuta_polizza"
                type="file"
                onChange={(e) => setPaymentReceipt(e.target.files?.[0] || null)}
                className="input-field text-sm file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-100"
              />
              {paymentReceipt ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5" />
                  {paymentReceipt.name}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Allegato opzionale.</p>
              )}
            </div>

            {submitError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{submitError}</div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={submitting} onClick={closeModal}>
                Annulla
              </button>
              <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={submitting} onClick={() => void handleConfirmRequest()}>
                {submitting ? (
                  <>
                    <Upload className="h-3.5 w-3.5 animate-spin" />
                    Invio…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Conferma
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
