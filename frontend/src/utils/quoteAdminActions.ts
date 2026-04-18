/** Controlli azioni su lista preventivi (admin, supervisore, struttura), allineati al backend per il download. */

import { hasSavedRcAutoElaborazione } from './rcAutoElaboration';

export function adminCanAssignQuote(stato: string | undefined): boolean {
  return stato === 'PRESENTATA';
}

export function adminCanReassignQuote(stato: string | undefined): boolean {
  return stato === 'ASSEGNATA';
}

export function adminCanDownloadPreventivoFinale(quote: {
  stato?: string;
  tipo_codice?: string | null;
  preventivo_finale_attachment_id?: number | null;
  preventivo_riepilogo_attachment_id?: number | null;
  /** Come in `Quote`: JSON pratica, include `elaborazione_rc_auto` per RC Auto. */
  dati_preventivo?: Record<string, unknown> | null;
}): boolean {
  if (quote.stato !== 'ELABORATA') return false;
  if (String(quote.tipo_codice || '').toLowerCase() === 'rc_auto') {
    return (
      quote.preventivo_riepilogo_attachment_id != null || hasSavedRcAutoElaborazione(quote.dati_preventivo)
    );
  }
  return quote.preventivo_finale_attachment_id != null;
}
