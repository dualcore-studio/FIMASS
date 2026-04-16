import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';

export const POLICY_PAYMENT_BENEFICIARY = 'TUO BROKER SRLS';
export const POLICY_PAYMENT_IBAN = 'IT28S0832703204000000016674';
export const POLICY_PAYMENT_AGENCY_ADDRESS = 'BCC ROMA Ag. 4 - Via Russolillo Don Giustino, 7 00138 ROMA';

export function buildPolicyPaymentCausale(
  assistitoNome: string | null | undefined,
  assistitoCognome: string | null | undefined,
): string {
  const nominativo = [assistitoNome, assistitoCognome]
    .flatMap((p) => (p != null && String(p).trim() !== '' ? [String(p).trim()] : []))
    .join(' ');
  const contraente = nominativo || 'N/D';
  return `Polizza ${contraente}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface PolicyPaymentExtremesCardProps {
  assistitoNome: string | null | undefined;
  assistitoCognome: string | null | undefined;
}

export default function PolicyPaymentExtremesCard({
  assistitoNome,
  assistitoCognome,
}: PolicyPaymentExtremesCardProps) {
  const causale = buildPolicyPaymentCausale(assistitoNome, assistitoCognome);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCopied = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setCopyHint('Copiato');
    hintTimer.current = setTimeout(() => {
      setCopyHint(null);
      hintTimer.current = null;
    }, 2000);
  }, []);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const onCopyIban = async () => {
    const ok = await copyToClipboard(POLICY_PAYMENT_IBAN);
    if (ok) flashCopied();
  };

  const onCopyCausale = async () => {
    const ok = await copyToClipboard(causale);
    if (ok) flashCopied();
  };

  return (
    <section
      className="rounded-xl border border-slate-200/95 bg-gradient-to-b from-slate-50/95 to-slate-50/40 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] sm:p-5"
      aria-labelledby="policy-payment-extremes-heading"
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3
          id="policy-payment-extremes-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600"
        >
          Estremi per il pagamento
        </h3>
        {copyHint ? (
          <p className="text-xs font-medium text-emerald-700 sm:text-right" role="status" aria-live="polite">
            {copyHint}
          </p>
        ) : null}
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">Beneficiario</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{POLICY_PAYMENT_BENEFICIARY}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-slate-500">IBAN</dt>
          <dd className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="break-all font-mono text-[13px] font-medium tracking-tight text-slate-900">
              {POLICY_PAYMENT_IBAN}
            </span>
            <button
              type="button"
              onClick={() => void onCopyIban()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copia IBAN
            </button>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-slate-500">Indirizzo agenzia</dt>
          <dd className="mt-0.5 text-slate-800 leading-snug">{POLICY_PAYMENT_AGENCY_ADDRESS}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-slate-500">Causale</dt>
          <dd className="mt-1 space-y-2">
            <p className="rounded-lg border border-white/60 bg-white/70 px-3 py-2.5 text-slate-800 leading-relaxed shadow-sm">
              {causale}
            </p>
            <button
              type="button"
              onClick={() => void onCopyCausale()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copia causale
            </button>
          </dd>
        </div>
      </dl>
    </section>
  );
}
