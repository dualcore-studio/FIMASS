export type CommissionStructureType = 'SEGNALATORE' | 'PARTNER';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'supervisore' | 'operatore' | 'struttura';
  nome: string | null;
  cognome: string | null;
  denominazione: string | null;
  email: string;
  telefono: string | null;
  stato: 'attivo' | 'disattivo';
  /** Solo utenti con ruolo struttura; impostabile solo dall’admin. */
  commission_type?: CommissionStructureType | null;
  enabled_types: string[] | null;
  last_login: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Voce per select strutture (es. provvigioni, filtri polizze). */
export interface StructureOption {
  id: number;
  denominazione: string | null;
  email: string;
  role: 'struttura';
  commission_type: CommissionStructureType;
}

export interface Commission {
  id: number;
  date: string;
  customer_name: string;
  policy_number: string;
  structure_id: number;
  structure_name: string | null;
  portal: string | null;
  company: string | null;
  policy_premium: number | null;
  broker_commission: number | null;
  client_invoice: number | null;
  sportello_amico_commission: number;
  structure_commission_type: CommissionStructureType;
  structure_commission_percentage: number;
  structure_commission_amount: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CommissionsListResponse extends PaginatedResponse<Commission> {
  summary: {
    totale_polizze: number;
    totale_premi: number;
    totale_sportello_amico: number;
    totale_provigioni_strutture: number;
  };
}

export interface InsuranceType {
  id: number;
  nome: string;
  codice: string;
  stato: string;
  ordine: number;
  descrizione?: string | null;
  campi_specifici: FormField[];
  checklist_allegati: ChecklistItem[];
}

export interface FormField {
  nome: string;
  label: string;
  tipo: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea' | 'radio' | 'multiselect' | 'heading' | 'info';
  obbligatorio: boolean;
  opzioni?: string[];
  /** Testo mostrato sotto il select quando l'opzione corrispondente è selezionata (chiave = valore opzione). */
  descrizioni_opzione?: Record<string, string>;
  placeholder?: string | null;
  ordine?: number;
  stato?: 'attivo' | 'disattivo';
  condizione?: string;
}

export interface ChecklistItem {
  nome: string;
  obbligatorio: boolean;
  condizione?: string;
  descrizione?: string | null;
  ordine?: number;
  stato?: 'attivo' | 'disattivo';
  sezione?: string;
}

export interface AssistedPerson {
  id: number;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  codice_fiscale: string | null;
  cellulare: string | null;
  email: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  num_preventivi?: number;
  num_polizze?: number;
  quotes?: Quote[];
  policies?: Policy[];
  attachments?: Attachment[];
}

export interface Quote {
  id: number;
  numero: string;
  assistito_id: number;
  tipo_assicurazione_id: number;
  struttura_id: number;
  operatore_id: number | null;
  stato: 'PRESENTATA' | 'ASSEGNATA' | 'IN LAVORAZIONE' | 'STANDBY' | 'ELABORATA';
  data_decorrenza: string | null;
  note_struttura: string | null;
  note_allegati?: string | null;
  dati_specifici: Record<string, unknown> | null;
  dati_preventivo: Record<string, unknown> | null;
  has_policy: number;
  created_at: string;
  updated_at: string;
  assistito_nome?: string;
  assistito_cognome?: string;
  assistito_cf?: string;
  assistito_data_nascita?: string;
  assistito_cellulare?: string;
  assistito_email?: string;
  assistito_indirizzo?: string;
  assistito_cap?: string;
  assistito_citta?: string;
  tipo_nome?: string;
  tipo_codice?: string;
  struttura_nome?: string;
  struttura_email?: string;
  operatore_nome?: string;
  operatore_cognome?: string;
  /** Allegato tipo preventivo_elaborato più recente (solo elenco/API arricchito) */
  preventivo_finale_attachment_id?: number | null;
  preventivo_finale_nome?: string | null;
  history?: StatusHistory[];
  notes?: QuoteNote[];
  attachments?: Attachment[];
  policy?: { id: number; numero: string; stato: string } | null;
}

export interface Policy {
  id: number;
  numero: string;
  quote_id: number;
  assistito_id: number;
  tipo_assicurazione_id: number;
  struttura_id: number;
  operatore_id: number | null;
  stato: 'RICHIESTA PRESENTATA' | 'IN EMISSIONE' | 'EMESSA';
  dati_specifici: Record<string, unknown> | null;
  note_struttura: string | null;
  note_interne: string | null;
  created_at: string;
  updated_at: string;
  assistito_nome?: string;
  assistito_cognome?: string;
  assistito_cf?: string;
  assistito_data_nascita?: string;
  assistito_cellulare?: string;
  assistito_email?: string;
  assistito_indirizzo?: string;
  assistito_cap?: string;
  assistito_citta?: string;
  tipo_nome?: string;
  tipo_codice?: string;
  struttura_nome?: string;
  operatore_nome?: string;
  operatore_cognome?: string;
  preventivo_numero?: string;
  preventivo_id?: number;
  ricevuta_pagamento_attachment_id?: number | null;
  polizza_emessa_attachment_id?: number | null;
  history?: StatusHistory[];
  attachments?: Attachment[];
}

export interface StatusHistory {
  id: number;
  stato_precedente: string | null;
  stato_nuovo: string;
  motivo: string | null;
  utente_id: number;
  nome?: string;
  cognome?: string;
  denominazione?: string;
  role?: string;
  created_at: string;
}

export interface QuoteNote {
  id: number;
  quote_id: number;
  utente_id: number;
  tipo: string;
  testo: string;
  nome?: string;
  cognome?: string;
  denominazione?: string;
  role?: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  entity_type: string;
  entity_id: number;
  tipo: string;
  nome_file: string;
  nome_originale: string;
  mime_type: string;
  dimensione: number;
  caricato_da: number;
  caricato_nome?: string;
  caricato_cognome?: string;
  caricato_denominazione?: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  utente_id: number;
  utente_nome: string;
  ruolo: string;
  azione: string;
  modulo: string;
  riferimento_id: number | null;
  riferimento_tipo: string | null;
  dettaglio: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InProgressQuoteRow {
  id: number;
  numero: string;
  operatore_id: number | null;
  operatore_nome?: string;
  operatore_cognome?: string;
  in_lavorazione_dal: string;
  updated_at: string;
}

export interface QuoteReminder {
  id: number;
  quote_id: number;
  quote_numero: string;
  created_at: string;
  read_at: string | null;
  created_by_role: 'admin' | 'supervisore' | 'operatore' | 'struttura';
  created_by_nome?: string | null;
  created_by_cognome?: string | null;
  created_by_denominazione?: string | null;
}
