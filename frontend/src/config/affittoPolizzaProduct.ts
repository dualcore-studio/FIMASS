/** Prodotto unico “Tutela Affitto” (Polizza Affitto) — dati statici per card introduttiva e payload richiesta. */

export const TUTELA_AFFITTO_RIEPILOGO_PDF = 'riepilogo_polizza_affitto.pdf';

/** URL pubblico (cartella `public/`) per download / link diretto. */
export const TUTELA_AFFITTO_PDF_HREF = `/${TUTELA_AFFITTO_RIEPILOGO_PDF}`;

export const TUTELA_AFFITTO_COSA_COPRE: string[] = [
  'Fino a 12 mensilità per canoni non pagati',
  'Fino a 3 mensilità per danni arrecati e/o spese condominiali non versate',
  'Assistenza legale inclusa per tutta la procedura di sfratto',
  'Gestione iniziale della morosità con solleciti telefonici e messa in mora',
  'Presa in carico della pratica e avvio dell’iter legale in caso di mancato pagamento',
];

export const TUTELA_AFFITTO_COME_FUNZIONA: string[] = [
  'La società analizza prima l’inquilino',
  'In caso di esito positivo viene attivata la protezione',
  'La copertura dura fino alla prima scadenza contrattuale',
  'Se l’inquilino non paga, si attiva la gestione della morosità',
];

export type ProdottoAffittoPayload = {
  product_code: 'tutela_affitto';
  product_name: string;
  starting_price_label: string;
  riepilogo_pdf: string;
  intro_visualizzata: true;
};

export function getProdottoAffittoPayloadForQuote(): ProdottoAffittoPayload {
  return {
    product_code: 'tutela_affitto',
    product_name: 'Tutela Affitto',
    starting_price_label: 'Una mensilità della locazione',
    riepilogo_pdf: TUTELA_AFFITTO_RIEPILOGO_PDF,
    intro_visualizzata: true,
  };
}
