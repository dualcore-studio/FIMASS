import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../../components/ui/Modal';
import { api, ApiError } from '../../utils/api';
import type { Commission } from '../../types';
import {
  commissionPercentForType,
  formatDate,
  formatEuro,
  getCommissionTypeBadgeClass,
  getCommissionTypeLabel,
  SPORTELLO_AMICO_QUOTA_OF_BROKER,
} from '../../utils/helpers';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  commission: Commission | null;
  onSaved: () => void | Promise<void>;
};

export default function CommissionAmountsModal({ isOpen, onClose, commission, onSaved }: Props) {
  const [policyPremium, setPolicyPremium] = useState('');
  const [clientInvoice, setClientInvoice] = useState('');
  const [provvigioniBroker, setProvvigioniBroker] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !commission) return;
    setPolicyPremium(commission.policy_premium != null ? String(commission.policy_premium) : '');
    setClientInvoice(commission.client_invoice != null ? String(commission.client_invoice) : '');
    const pb = commission.provvigioni_broker ?? commission.broker_commission;
    if (pb != null && String(pb) !== '' && Number.isFinite(Number(pb))) {
      setProvvigioniBroker(String(pb));
    } else {
      setProvvigioniBroker('');
    }
    setError(null);
  }, [isOpen, commission]);

  const previewType = commission?.structure_commission_type ?? 'SEGNALATORE';
  const previewPct = commissionPercentForType(previewType);
  const brokerNum = Number(String(provvigioniBroker).replace(',', '.'));
  const hasValidBroker = Number.isFinite(brokerNum) && brokerNum >= 0 && provvigioniBroker.trim() !== '';
  const previewStructAmount = hasValidBroker ? roundMoney(brokerNum * (previewPct / 100)) : null;
  const previewSaQuota = hasValidBroker ? roundMoney(brokerNum * SPORTELLO_AMICO_QUOTA_OF_BROKER) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!commission) return;
    const premRaw = policyPremium.trim();
    const invRaw = clientInvoice.trim();
    const brRaw = provvigioniBroker.trim();

    let provv: number | null = null;
    if (brRaw !== '') {
      const br = Number(brRaw.replace(',', '.'));
      if (!Number.isFinite(br) || br < 0) {
        setError('Provvigioni broker: inserire un numero ≥ 0 o lasciare vuoto.');
        return;
      }
      provv = br;
    }

    const policy_premium =
      premRaw === '' ? null : Number(premRaw.replace(',', '.'));
    const client_invoice =
      invRaw === '' ? null : Number(invRaw.replace(',', '.'));
    if ((policy_premium !== null && !Number.isFinite(policy_premium)) || (client_invoice !== null && !Number.isFinite(client_invoice))) {
      setError('Premio o fattura cliente: importi non validi.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.put<Commission>(`/commissions/${commission.id}`, {
        provvigioni_broker: provv,
        policy_premium,
        client_invoice,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    commission?.commission_status === 'DA_VALORIZZARE' ? 'Inserisci importi provvigionali' : 'Modifica importi provvigionali';

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title={title} size="md">
      {!commission ? null : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{commission.customer_name}</p>
            <p className="mt-1 text-xs text-slate-600">
              Polizza <span className="font-mono">{commission.policy_number}</span>
              {' · '}
              {formatDate(commission.date)}
              {commission.structure_name ? ` · ${commission.structure_name}` : null}
            </p>
            {commission.company ? (
              <p className="mt-1 text-xs text-slate-600">
                Compagnia: <span className="font-medium text-slate-800">{commission.company}</span>
              </p>
            ) : null}
          </div>

          {commission.commission_status === 'DA_VALORIZZARE' ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
              Importi provvigionali non ancora inseriti. Puoi registrare la base provvigione broker e gli altri importi quando
              disponibili; lo stato passerà automaticamente a <strong>Valorizzata</strong>.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Premio polizza (€)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={policyPremium}
                onChange={(e) => setPolicyPremium(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Fattura cliente (€)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={clientInvoice}
                onChange={(e) => setClientInvoice(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Provvigioni broker (€)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={provvigioniBroker}
                onChange={(e) => setProvvigioniBroker(e.target.value)}
                className="input-field"
                placeholder="Lascia vuoto se non disponibile"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo struttura</p>
            <span className={`badge mt-2 ${getCommissionTypeBadgeClass(previewType)}`}>
              {getCommissionTypeLabel(previewType)}
            </span>
            {hasValidBroker ? (
              <ul className="mt-3 space-y-1.5 text-gray-700">
                <li className="flex justify-between gap-2">
                  <span className="text-gray-500">Provvigione struttura ({previewPct}%)</span>
                  <span className="font-semibold">{formatEuro(previewStructAmount)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-gray-500">Quota Sportello Amico (65%)</span>
                  <span className="font-semibold">{formatEuro(previewSaQuota)}</span>
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                Anteprima calcoli: inserisci la provvigione broker oppure conferma solo premio/fattura se vuoi aggiornarli senza valorizzare.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button type="button" disabled={submitting} onClick={onClose} className="btn-secondary">
              Chiudi
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Salvataggio…' : 'Salva importi'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
