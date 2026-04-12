import { api } from './api';

/**
 * Scarica il PDF del preventivo elaborato più recente per la pratica.
 * Endpoint unico condiviso tra menu Azioni e dettaglio pratica.
 */
export async function downloadPreventivoFinale(quoteId: number, filename: string): Promise<void> {
  const safeName = filename?.trim() || `preventivo-finale-${quoteId}.pdf`;
  await api.download(`/quotes/${quoteId}/preventivo-finale`, safeName);
}
