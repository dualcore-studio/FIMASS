import { Download, Home } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import {
  CASA_POLIZZA_PACKAGES,
  formatPremioCasaIt,
  type CasaPackageDef,
} from '../../config/casaPolizzaPackages';

type Props = {
  onBackToTipologie: () => void;
  onSelectPackageContinue: (pkg: CasaPackageDef) => void;
};

function safePdfFilename(nome: string): string {
  return `Riepilogo-${nome.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_')}.pdf`;
}

export default function CasaPolizzaPackageStep({ onBackToTipologie, onSelectPackageContinue }: Props) {
  const downloadPdf = async (pkg: CasaPackageDef) => {
    try {
      await api.download(`/quotes/casa-pacchetti/${encodeURIComponent(pkg.id)}/riepilogo-pdf`, safePdfFilename(pkg.nome));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Download non riuscito.';
      window.alert(msg);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Polizza Casa — scelta pacchetto</h2>
          <p className="text-sm text-gray-600">
            Confronta i pacchetti con garanzie e premio finale. Puoi scaricare il riepilogo PDF per la firma del cliente,
            poi procedi con la richiesta di preventivo.
          </p>
        </div>
        <button type="button" onClick={onBackToTipologie} className="btn-secondary shrink-0 text-sm">
          Cambia tipologia
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CASA_POLIZZA_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-start gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-snug text-gray-900">{pkg.nome}</h3>
              </div>
            </div>

            <ul className="mb-4 flex-1 space-y-2 border-y border-gray-100 py-3 text-sm text-gray-700">
              {pkg.righe.map((r) => (
                <li key={r.label} className="flex justify-between gap-3">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="shrink-0 font-medium text-gray-900">{r.valore}</span>
                </li>
              ))}
            </ul>

            <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Premio finale</p>
              <p className="text-xl font-bold text-[#0B4EA2]">{formatPremioCasaIt(pkg.premio_finale_euro)}</p>
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void downloadPdf(pkg)}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 py-2 text-sm"
              >
                <Download className="h-4 w-4" />
                Scarica riepilogo PDF
              </button>
              <button
                type="button"
                onClick={() => onSelectPackageContinue(pkg)}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2 text-sm"
              >
                Seleziona pacchetto e continua
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
