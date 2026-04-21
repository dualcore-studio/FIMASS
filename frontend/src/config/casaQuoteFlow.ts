import type { FormField } from '../types';

/** Chiave `tipo` in FormData upload allegati preventivo Casa (facoltativo). */
export const CASA_PREVENTIVO_FIRMATO_TIPO = 'preventivo_firmato';

/**
 * Campi dati specifici Casa legati alla scelta manuale delle garanzie (RCT / elenco garanzie).
 * Con pacchetto predefinito non vanno mostrati né salvati: le garanzie derivano dal pacchetto.
 */
export const CASA_MANUAL_GUARANTEE_FIELD_NAMES = new Set([
  'massimale_rct',
  'garanzie_casa',
  /** Blocco informativo sopra le garanzie manuali */
  '_info_garanzie_casa',
]);

/** Rimuove da `dati` le chiavi delle garanzie manuali (es. dopo submit o cambio flusso). */
export function omitCasaManualGuaranteeFields(dati: Record<string, unknown>): Record<string, unknown> {
  const next = { ...dati };
  for (const k of CASA_MANUAL_GUARANTEE_FIELD_NAMES) {
    delete next[k];
  }
  return next;
}

export function filterCasaCampiHideManualGuarantees(
  fields: FormField[],
  hideManualGuarantees: boolean,
): FormField[] {
  if (!hideManualGuarantees) return fields;
  return fields.filter((f) => !CASA_MANUAL_GUARANTEE_FIELD_NAMES.has(f.nome));
}

export function labelForQuoteAttachmentTipo(tipo: string): string {
  if (tipo === CASA_PREVENTIVO_FIRMATO_TIPO) return 'Preventivo firmato';
  return tipo.replace(/_/g, ' ');
}
