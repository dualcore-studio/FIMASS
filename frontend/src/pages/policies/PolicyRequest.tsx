import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Upload, FileText } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Quote } from '../../types';
import { formatDate } from '../../utils/helpers';
import StatusBadge from '../../components/common/StatusBadge';

export default function PolicyRequest() {
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('quote_id');
  const navigate = useNavigate();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [noteStruttura, setNoteStruttura] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!quoteId) {
      setError('Nessun preventivo specificato.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<Quote>(`/quotes/${quoteId}`);
      setQuote(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare il preventivo.');
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteId) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const newPolicy = await api.post<{ id: number }>('/policies', {
        quote_id: Number(quoteId),
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

      navigate(`/polizze/${newPolicy.id}`);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Impossibile richiedere l\'emissione della polizza.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento preventivo…</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/preventivi')} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Torna ai preventivi
        </button>
        <div className="card p-8 text-center text-red-700">{error || 'Preventivo non trovato.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-slate-900">Richiedi Emissione Polizza</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dal preventivo <span className="font-medium text-slate-700">{quote.numero}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Assistito</h3>
          <dl className="space-y-3 text-sm">
            <ReadOnlyField label="Nome e Cognome" value={`${quote.assistito_nome || ''} ${quote.assistito_cognome || ''}`} />
            <ReadOnlyField label="Codice Fiscale" value={quote.assistito_cf} mono />
            <ReadOnlyField label="Data di Nascita" value={formatDate(quote.assistito_data_nascita)} />
            <ReadOnlyField label="Cellulare" value={quote.assistito_cellulare} />
            <ReadOnlyField label="Email" value={quote.assistito_email} />
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Dettagli Preventivo</h3>
          <dl className="space-y-3 text-sm">
            <ReadOnlyField label="Numero" value={quote.numero} mono />
            <ReadOnlyField label="Tipologia" value={quote.tipo_nome} />
            <ReadOnlyField label="Struttura" value={quote.struttura_nome} />
            <div>
              <dt className="text-xs font-medium text-slate-500">Stato</dt>
              <dd className="mt-1"><StatusBadge stato={quote.stato} /></dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="card p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Dati Richiesta Polizza</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="note_struttura" className="mb-1 block text-sm font-medium text-slate-700">
                Note della struttura
              </label>
              <textarea
                id="note_struttura"
                rows={4}
                value={noteStruttura}
                onChange={(e) => setNoteStruttura(e.target.value)}
                className="input-field resize-none"
                placeholder="Eventuali note o comunicazioni per l'operatore..."
              />
            </div>

            <div>
              <label htmlFor="payment-receipt" className="mb-1 block text-sm font-medium text-slate-700">
                Ricevuta di pagamento
              </label>
              <input
                id="payment-receipt"
                type="file"
                onChange={(e) => setPaymentReceipt(e.target.files?.[0] || null)}
                className="input-field text-sm file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-100"
              />
              {paymentReceipt && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5" />
                  {paymentReceipt.name}
                </p>
              )}
            </div>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{submitError}</div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-3 py-1.5 text-xs">
                Annulla
              </button>
              <button type="submit" disabled={submitting} className="btn-primary px-3 py-1.5 text-xs">
                {submitting ? (
                  <>
                    <Upload className="h-3.5 w-3.5 animate-spin" />
                    Invio...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Richiedi Emissione
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {quote.dati_specifici && Object.keys(quote.dati_specifici).length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Dati Specifici</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {Object.entries(quote.dati_specifici).map(([key, value]) => (
              <ReadOnlyField
                key={key}
                label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                value={typeof value === 'boolean' ? (value ? 'Sì' : 'No') : String(value ?? '-')}
              />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`mt-0.5 text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value?.trim() || <span className="text-gray-400">-</span>}
      </dd>
    </div>
  );
}
