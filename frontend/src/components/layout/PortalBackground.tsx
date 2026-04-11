/**
 * Sfondo portale: base crema e velatura molto leggera (stile Sportello Amico).
 */
export function PortalBackgroundLayers() {
  return (
    <>
      <div className="absolute inset-0 bg-[var(--portal-app-bg)]" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-15%,var(--portal-app-bg-soft)_0%,transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_100%_0%,rgba(30,45,77,0.04),transparent_50%)]"
        aria-hidden
      />
    </>
  );
}
