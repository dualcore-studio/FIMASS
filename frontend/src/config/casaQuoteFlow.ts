import type { FormField } from '../types';
import { activeCampiForFlow } from '../utils/insuranceTypeConfig';

/** Chiave `tipo` in FormData upload allegati preventivo Casa (facoltativo). */
export const CASA_PREVENTIVO_FIRMATO_TIPO = 'preventivo_firmato';

/**
 * Con pacchetto Casa predefinito, lo step «dati specifici» termina a questo campo (incluso).
 * Tutti i campi successivi nell’ordine attivo sono esclusi (garanzie / coperture manuali).
 */
export const CASA_DATI_SPECIFICI_LAST_FIELD_WITH_PACKAGE = 'indirizzo_immobile';

/**
 * Campi dati specifici Casa legati alla scelta manuale delle garanzie (RCT / elenco garanzie).
 * Usati come fallback se nel tipo non compare `indirizzo_immobile`.
 */
export const CASA_MANUAL_GUARANTEE_FIELD_NAMES = new Set([
  'massimale_rct',
  'garanzie_casa',
  '_info_garanzie_casa',
]);

/**
 * Flusso con pacchetto: solo campi fino a indirizzo immobile (ordine del flusso attivo).
 */
export function filterCasaCampiForPackageSelected(fields: FormField[]): FormField[] {
  const idx = fields.findIndex((f) => f.nome === CASA_DATI_SPECIFICI_LAST_FIELD_WITH_PACKAGE);
  if (idx === -1) {
    return fields.filter((f) => !CASA_MANUAL_GUARANTEE_FIELD_NAMES.has(f.nome));
  }
  return fields.slice(0, idx + 1);
}

/**
 * Rimuove da `dati` le chiavi dei campi che seguono `indirizzo_immobile` nel flusso attivo,
 * così non restano valori residui passando da personalizzato a pacchetto o da invii errati.
 */
export function omitCasaDatiAfterIndirizzoImmobile(
  dati: Record<string, unknown>,
  campiSpecifici: FormField[],
): Record<string, unknown> {
  const active = activeCampiForFlow(campiSpecifici, dati);
  const idx = active.findIndex((f) => f.nome === CASA_DATI_SPECIFICI_LAST_FIELD_WITH_PACKAGE);
  if (idx === -1) {
    const next = { ...dati };
    for (const k of CASA_MANUAL_GUARANTEE_FIELD_NAMES) delete next[k];
    return next;
  }
  const tail = active.slice(idx + 1).map((f) => f.nome);
  const next = { ...dati };
  for (const k of tail) delete next[k];
  return next;
}

export function labelForQuoteAttachmentTipo(tipo: string): string {
  if (tipo === CASA_PREVENTIVO_FIRMATO_TIPO) return 'Preventivo firmato';
  return tipo.replace(/_/g, ' ');
}
