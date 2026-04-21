/** Chiave `tipo` in FormData upload allegati preventivo Casa (facoltativo). */
export const CASA_PREVENTIVO_FIRMATO_TIPO = 'preventivo_firmato';

export function labelForQuoteAttachmentTipo(tipo: string): string {
  if (tipo === CASA_PREVENTIVO_FIRMATO_TIPO) return 'Preventivo firmato';
  return tipo.replace(/_/g, ' ');
}
