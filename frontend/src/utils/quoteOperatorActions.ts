/** Abilitazione voci menu Azioni (profilo operatore) — allineato alle transizioni backend. */

export function operatorCanStandby(stato: string | undefined): boolean {
  return stato === 'ASSEGNATA' || stato === 'IN LAVORAZIONE';
}

export function operatorCanInLavorazione(stato: string | undefined): boolean {
  return stato === 'ASSEGNATA' || stato === 'STANDBY';
}

export function operatorCanElaborata(stato: string | undefined): boolean {
  return stato === 'STANDBY' || stato === 'IN LAVORAZIONE';
}
