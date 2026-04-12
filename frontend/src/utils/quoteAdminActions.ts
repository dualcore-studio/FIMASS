/** Controlli azioni admin sulla lista preventivi (allineati al backend). */

export function adminCanAssignQuote(stato: string | undefined): boolean {
  return stato === 'PRESENTATA';
}

export function adminCanReassignQuote(stato: string | undefined): boolean {
  return stato === 'ASSEGNATA';
}

export function adminCanDownloadPreventivoFinale(
  stato: string | undefined,
  preventivoFinaleAttachmentId: number | null | undefined,
): boolean {
  return stato === 'ELABORATA' && preventivoFinaleAttachmentId != null;
}
