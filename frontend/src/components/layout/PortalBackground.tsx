/**
 * Sfondo portale: griglia leggera e gradiente soft su base grigio freddo (#F3F5F9).
 * Usare dentro un contenitore `absolute inset-0` o `fixed inset-0` con `pointer-events-none`.
 */
export function PortalBackgroundLayers() {
  return (
    <>
      <div className="absolute inset-0 bg-[var(--portal-app-bg)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_50%_-28%,var(--portal-app-bg-soft)_0%,var(--portal-app-bg)_48%,#ebf0f6_100%)]" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(11,78,162,0.045),transparent_58%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(15,23,42,0.028)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.55] bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[length:48px_48px]"
        aria-hidden
      />
    </>
  );
}
