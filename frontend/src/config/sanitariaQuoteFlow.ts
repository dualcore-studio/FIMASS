import type { FormField } from '../types';
import { activeCampiForFlow } from '../utils/insuranceTypeConfig';

/** Campi del flusso attivo (esclusi heading/info) da non persistere con pacchetto predefinito. */
function editableCampiNomi(campiSpecifici: FormField[], dati: Record<string, unknown>): string[] {
  return activeCampiForFlow(campiSpecifici, dati)
    .filter((f) => f.tipo !== 'heading' && f.tipo !== 'info')
    .map((f) => f.nome);
}

export function omitSanitariaEditableDati(
  dati: Record<string, unknown>,
  campiSpecifici: FormField[],
): Record<string, unknown> {
  const keys = editableCampiNomi(campiSpecifici, dati);
  const next = { ...dati };
  for (const k of keys) delete next[k];
  return next;
}
