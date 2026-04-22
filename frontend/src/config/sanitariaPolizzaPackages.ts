import packs from '../../../shared/sanitariaPolizzaPackages.json';

export type SanitariaPackageDef = {
  codice: string;
  nome: string;
  premio_starting_euro: number;
  eta_ingresso_max: number;
  pdf_file: string;
  highlights: string[];
};

export const SANITARIA_POLIZZA_PACKAGES = packs as SanitariaPackageDef[];

export function getSanitariaPackageDefByCodice(
  codice: string | undefined | null,
): SanitariaPackageDef | undefined {
  if (!codice) return undefined;
  return SANITARIA_POLIZZA_PACKAGES.find((p) => p.codice === codice);
}

export function formatPremioStartingIt(euro: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(euro);
}

/** Percorso pubblico per il download (cartella `public/pacchetti-sanitaria/`). */
export function publicPdfPathForPackage(pdfFile: string): string {
  return `/pacchetti-sanitaria/${encodeURI(pdfFile)}`;
}

/** Download diretto del PDF statico in `public/pacchetti-sanitaria/`. */
export function downloadSanitariaPacchettoPdf(pdfFile: string): void {
  const a = document.createElement('a');
  a.href = publicPdfPathForPackage(pdfFile);
  a.setAttribute('download', pdfFile);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
