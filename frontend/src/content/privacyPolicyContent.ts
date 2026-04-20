import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_CONTACT_PEC,
  PRIVACY_LAST_UPDATED,
  PRIVACY_POLICY_VERSION,
} from '../config/privacyConfig';

export type PrivacySectionDef = { id: string; title: string; paragraphs: string[] };

export const privacyPolicySections: PrivacySectionDef[] = [
  {
    id: 'intro',
    title: 'Introduzione',
    paragraphs: [
      'La presente informativa descrive il trattamento dei dati personali effettuato tramite il portale FIMASS by Sportello Amico, dedicato ai servizi di preventivazione e alla gestione delle polizze assicurative, inclusa la raccolta della documentazione necessaria all’elaborazione delle pratiche.',
      'L’informativa è fornita ai sensi del Regolamento (UE) 2016/679 (“GDPR”) e della normativa italiana applicabile in materia di protezione dei dati personali.',
    ],
  },
  {
    id: 'titolare',
    title: 'Titolare del trattamento',
    paragraphs: [
      'Il Titolare del trattamento è Tuo Broker SRLS, nella persona del legale rappresentante pro tempore, con riferimento all’attività di intermediazione assicurativa svolta in favore degli utenti del portale FIMASS by Sportello Amico.',
      'Indirizzo, PEC e recapiti completi possono essere integrati dal Titolare nei dati di contatto indicati in calce alla presente informativa.',
    ],
  },
  {
    id: 'responsabili',
    title: 'Responsabile del trattamento e soggetti coinvolti',
    paragraphs: [
      'Ove nominati, i Responsabili del trattamento sono individuati con atto separato e comunicati agli interessati quando richiesto dalla legge.',
      'Il personale e i fornitori tecnici autorizzati possono accedere ai dati nel rispetto di istruzioni documentate e di misure di sicurezza adeguate.',
    ],
  },
  {
    id: 'finalita',
    title: 'Finalità del trattamento',
    paragraphs: [
      'Gestione delle richieste di preventivo e delle pratiche assicurative collegate, inclusa la raccolta e la conservazione della documentazione necessaria.',
      'Comunicazioni strumentali all’esecuzione del servizio richiesto (es. aggiornamenti di stato, messaggistica interna al portale, notifiche operative).',
      'Adempimenti di legge, contabili e fiscali connessi all’attività di intermediazione assicurativa.',
      'Previo consenso specifico e separato, invio di comunicazioni informative e promozionali relative ai servizi assicurativi.',
    ],
  },
  {
    id: 'base',
    title: 'Base giuridica',
    paragraphs: [
      'Esecuzione di misure precontrattuali e del contratto, ove applicabile (art. 6(1)(b) GDPR).',
      'Adempimento di obblighi legali (art. 6(1)(c) GDPR).',
      'Legittimo interesse, ove compatibile, per la gestione sicura del portale e la prevenzione di abusi (art. 6(1)(f) GDPR).',
      'Consenso dell’interessato, ove richiesto per finalità promozionali o ove la normativa lo impone (art. 6(1)(a) GDPR).',
    ],
  },
  {
    id: 'categorie',
    title: 'Tipologie di dati trattati',
    paragraphs: [
      'Dati anagrafici e di contatto dell’assistito e degli utenti del portale.',
      'Dati relativi alle richieste di preventivo, alle polizze e alla documentazione allegata (es. documenti di identità, attestazioni, dati del veicolo o del rischio, secondo quanto richiesto dalla tipologia di copertura).',
      'Dati di navigazione e di log tecnici necessari alla sicurezza e al funzionamento del portale.',
    ],
  },
  {
    id: 'modalita',
    title: 'Modalità di trattamento',
    paragraphs: [
      'I dati sono trattati con strumenti elettronici, secondo logiche strettamente correlate alle finalità indicate, e mediante misure tecniche e organizzative idonee a garantire riservatezza, integrità e disponibilità.',
      'L’accesso ai dati è consentito solo a soggetti autorizzati e nel rispetto dei profili di autorizzazione previsti dal portale.',
    ],
  },
  {
    id: 'conservazione',
    title: 'Conservazione',
    paragraphs: [
      'I dati sono conservati per il tempo necessario a perseguire le finalità per le quali sono stati raccolti e, successivamente, per il periodo previsto da obblighi di legge o per la tutela di diritti in sede contenziosa.',
      'I criteri di conservazione possono essere dettagliati in documentazione interna del Titolare e aggiornati nel tempo.',
    ],
  },
  {
    id: 'comunicazione',
    title: 'Comunicazione e trasferimenti',
    paragraphs: [
      'I dati possono essere comunicati a compagnie assicuratrici, coassicuratori, liquidatori e altri soggetti necessari all’erogazione del servizio assicurativo richiesto.',
      'Possono essere trattati da fornitori di servizi IT che agiscono come Responsabili o incaricati, sulla base di accordi contrattuali conformi al GDPR.',
      'Non è prevista diffusione dei dati, salvo obblighi di legge.',
    ],
  },
  {
    id: 'diritti',
    title: 'Diritti dell’interessato',
    paragraphs: [
      'L’interessato può esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione, portabilità ove applicabile, e revocare il consenso ove prestato, nei limiti previsti dalla legge.',
      'Può proporre reclamo all’Autorità Garante per la protezione dei dati personali (www.garanteprivacy.it).',
    ],
  },
  {
    id: 'esercizio',
    title: 'Modalità di esercizio dei diritti',
    paragraphs: [
      'Per esercitare i diritti o per informazioni sul trattamento è possibile contattare il Titolare ai recapiti indicati nella sezione Contatti, utilizzando preferibilmente la PEC per comunicazioni formali.',
    ],
  },
  {
    id: 'contatti',
    title: 'Contatti',
    paragraphs: [`Email: ${PRIVACY_CONTACT_EMAIL}`, `PEC: ${PRIVACY_CONTACT_PEC}`],
  },
];

export function getPrivacyFooterLines() {
  return {
    versionLine: `Versione informativa: ${PRIVACY_POLICY_VERSION}`,
    updatedLine: `Ultimo aggiornamento: ${PRIVACY_LAST_UPDATED}`,
  };
}
