import { Download, Home } from 'lucide-react';
import {
  TUTELA_AFFITTO_COME_FUNZIONA,
  TUTELA_AFFITTO_COSA_COPRE,
  TUTELA_AFFITTO_PDF_HREF,
} from '../../config/affittoPolizzaProduct';

type Props = {
  onBackToTipologie: () => void;
  onContinue: () => void;
};

export default function AffittoPolizzaIntroStep({ onBackToTipologie, onContinue }: Props) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Polizza Affitto</h2>
          <p className="max-w-2xl text-sm text-gray-600">
            Un solo prodotto dedicato al locatore. Leggi la scheda informativa e procedi con la richiesta di preventivo.
          </p>
        </div>
        <button type="button" onClick={onBackToTipologie} className="btn-secondary shrink-0 text-sm">
          Cambia tipologia
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Tutela Affitto</h3>
            <p className="mt-1 text-sm text-gray-600">
              Protezione per il proprietario in caso di morosità dell&apos;inquilino
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-gray-700">
          Soluzione pensata per il locatore che vuole tutelarsi dal rischio di mancato pagamento del canone e dalle
          principali problematiche che possono nascere durante la locazione.
        </p>

        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cosa copre</h4>
          <ul className="space-y-1.5 text-sm text-gray-800">
            {TUTELA_AFFITTO_COSA_COPRE.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-600" aria-hidden />
                <span className="leading-snug">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Come funziona</h4>
          <ul className="space-y-1.5 text-sm text-gray-800">
            {TUTELA_AFFITTO_COME_FUNZIONA.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
                <span className="leading-snug">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Premio a partire da</p>
          <p className="mt-1 text-2xl font-bold leading-tight text-[#0B4EA2]">Una mensilità della locazione</p>
          <p className="mt-2 text-xs leading-snug text-gray-500">
            Il costo effettivo viene confermato con preventivo ufficiale dopo l&apos;analisi dell&apos;inquilino.
          </p>
        </div>

        <a
          href={TUTELA_AFFITTO_PDF_HREF}
          download="riepilogo_polizza_affitto.pdf"
          className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Scarica riepilogo PDF
        </a>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm sm:w-auto sm:min-w-[240px]"
        >
          Prosegui con la richiesta
        </button>
      </div>
    </div>
  );
}
