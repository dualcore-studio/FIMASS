import { useEffect, useState } from 'react';
import { Download, HeartPulse } from 'lucide-react';
import {
  downloadSanitariaPacchettoPdf,
  formatPremioStartingIt,
  getSanitariaPackageDefByCodice,
  SANITARIA_POLIZZA_PACKAGES,
  type SanitariaPackageDef,
} from '../../config/sanitariaPolizzaPackages';

const NO_PACKAGE = '';

type Props = {
  committedPackageCodice: string | null;
  onBackToTipologie: () => void;
  onContinueWithPackage: (pkg: SanitariaPackageDef) => void;
  onContinuePersonalized: () => void;
};

export default function SanitariaPolizzaPackageStep({
  committedPackageCodice,
  onBackToTipologie,
  onContinueWithPackage,
  onContinuePersonalized,
}: Props) {
  const [selectedCodice, setSelectedCodice] = useState<string>(
    () => committedPackageCodice ?? NO_PACKAGE,
  );

  useEffect(() => {
    setSelectedCodice(committedPackageCodice ?? NO_PACKAGE);
  }, [committedPackageCodice]);

  const selectedPkg = selectedCodice ? getSanitariaPackageDefByCodice(selectedCodice) : undefined;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Polizza Sanitaria</h2>
          <p className="max-w-2xl text-sm text-gray-600">
            Puoi partire da un pacchetto predefinito con le garanzie principali e il premio indicati, oppure richiedere un
            preventivo personalizzato senza selezionare alcun pacchetto.
          </p>
        </div>
        <button type="button" onClick={onBackToTipologie} className="btn-secondary shrink-0 text-sm">
          Cambia tipologia
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="sanitaria-pacchetto-select" className="mb-1.5 block text-sm font-medium text-gray-700">
            Pacchetto (facoltativo)
          </label>
          <select
            id="sanitaria-pacchetto-select"
            value={selectedCodice}
            onChange={(e) => setSelectedCodice(e.target.value)}
            className="input-field max-w-xl"
          >
            <option value={NO_PACKAGE}>Nessun pacchetto / preventivo personalizzato</option>
            {SANITARIA_POLIZZA_PACKAGES.map((p) => (
              <option key={p.codice} value={p.codice}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        {selectedPkg ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{selectedPkg.nome}</h3>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Garanzie principali
                </p>
              </div>
            </div>

            <ul className="list-disc space-y-1 pl-4 text-sm leading-snug text-gray-700">
              {selectedPkg.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>

            <p className="mt-3 text-sm text-gray-700">
              <span className="text-gray-500">Età ingresso massima: </span>
              <span className="font-medium text-gray-900">{selectedPkg.eta_ingresso_max} anni</span>
            </p>

            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Premio a partire da</p>
              <p className="mt-0.5 text-2xl font-bold text-[#0B4EA2]">
                {formatPremioStartingIt(selectedPkg.premio_starting_euro)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => downloadSanitariaPacchettoPdf(selectedPkg.pdf_file)}
              className="btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Scarica riepilogo PDF
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
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
