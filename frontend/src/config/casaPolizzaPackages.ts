import packs from '../../../shared/casaPolizzaPackages.json';

export type CasaPackageRow = { label: string; valore: string };

export type CasaPackageDef = {
  id: string;
  nome: string;
  premio_finale_euro: number;
  righe: CasaPackageRow[];
};

export const CASA_POLIZZA_PACKAGES = packs as CasaPackageDef[];

export function getCasaPackageDefById(id: string | undefined | null): CasaPackageDef | undefined {
  if (!id) return undefined;
  return CASA_POLIZZA_PACKAGES.find((p) => p.id === id);
}

export function formatPremioCasaIt(euro: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(euro);
}
