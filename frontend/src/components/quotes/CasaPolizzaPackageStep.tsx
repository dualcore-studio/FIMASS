import { useEffect, useState } from 'react';
import { Download, Home } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import {
  CASA_POLIZZA_PACKAGES,
  formatPremioCasaIt,
  getCasaPackageDefById,
  type CasaPackageDef,
} from '../../config/casaPolizzaPackages';

const SELECT_PLACEHOLDER = '';

type Props = {
  committedPackageId: string | null;
  onBackToTipologie: () => void;
  onContinueWithPackage: (pkg: CasaPackageDef) => void;
  onContinuePersonalized: () => void;
};

function safePdfFilename(nome: string): string {
  return `Riepilogo-${nome.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_')}.pdf`;
}

export default function CasaPolizzaPackageStep({
  committedPackageId,
  onBackToTipologie,
  onContinueWithPackage,
  onContinuePersonalized,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>(() => committedPackageId ?? SELECT_PLACEHOLDER);

  useEffect(() => {
    setSelectedId(committedPackageId ?? SELECT_PLACEHOLDER);
  }, [committedPackageId]);

  const selectedPkg = selectedId ? getCasaPackageDefById(selectedId) : undefined;

  const downloadPdf = async (pkg: CasaPackageDef) => {
    try {
      await api.download(
        `/quotes/casa-pacchetti/${encodeURIComponent(pkg.id)}/riepilogo-pdf`,
        safePdfFilename(pkg.nome),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Download non riuscito.';
      window.alert(msg);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Polizza Casa</h2>
          <p className="max-w-2xl text-sm text-gray-600">
            Puoi scegliere uno dei pacchetti predefiniti con garanzie e premio indicati, oppure richiedere un preventivo
            personalizzato senza selezionare alcun pacchetto.
          </p>
        </div>
        <button type="button" onClick={onBackToTipologie} className="btn-secondary shrink-0 text-sm">
          Cambia tipologia
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor="casa-pacchetto-select" className="mb-1.5 block text-sm font-medium text-gray-700">
            Pacchetto (facoltativo)
          </label>
          <select
            id="casa-pacchetto-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input-field max-w-xl"
          >
            <option value={SELECT_PLACEHOLDER}>Seleziona un pacchetto</option>
            {CASA_POLIZZA_PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        {selectedPkg ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{selectedPkg.nome}</h3>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">Garanzie e massimali</p>
              </div>
            </div>

            <ul className="space-y-2 border-t border-gray-100 pt-4 text-sm text-gray-700">
              {selectedPkg.righe.map((r) => (
                <li key={r.label} className="flex justify-between gap-4">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="shrink-0 text-right font-medium text-gray-900">{r.valore}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Premio finale</p>
              <p className="mt-1 text-2xl font-bold text-[#0B4EA2]">{formatPremioCasaIt(selectedPkg.premio_finale_euro)}</p>
            </div>

            <button
              type="button"
              onClick={() => void downloadPdf(selectedPkg)}
              className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Scarica riepilogo PDF
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={!selectedPkg}
            onClick={() => selectedPkg && onContinueWithPackage(selectedPkg)}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 py-2.5 text-sm disabled:pointer-events-none disabled:opacity-45 sm:flex-none sm:min-w-[240px]"
          >
            Continua con questo pacchetto
          </button>
          <button
            type="button"
            onClick={onContinuePersonalized}
            className="btn-secondary inline-flex flex-1 items-center justify-center py-2.5 text-sm sm:flex-none sm:min-w-[260px]"
          >
            Continua con preventivo personalizzato
          </button>
        </div>
      </div>
    </div>
  );
}
