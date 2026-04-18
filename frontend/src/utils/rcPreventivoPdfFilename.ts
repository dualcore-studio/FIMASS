/** Nome file download per il PDF preventivo RC generato dal sistema (allineato al backend). */
export function rcPreventivoPdfDownloadFilename(quote: { numero?: string | null; id: number }): string {
  const raw = quote.numero?.trim() ?? '';
  const safe = raw.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
  if (safe) return `Preventivo-${safe}.pdf`;
  return `Preventivo-RC-${quote.id}.pdf`;
}
