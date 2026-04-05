/**
 * Stesso trattamento visivo dello sfondo della pagina di login (gradienti, vignetta, griglia).
 * Usare dentro un contenitore `absolute inset-0` o `fixed inset-0` con `pointer-events-none`.
 */
type PortalBackgroundVariant = 'default' | 'login';

export function PortalBackgroundLayers({ variant = 'default' }: { variant?: PortalBackgroundVariant }) {
  const baseAndGradient =
    variant === 'login' ? (
      <>
        <div className="absolute inset-0 bg-[#0F1B36]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#132344_0%,#0F1B36_35%,#0B1428_100%)]" />
      </>
    ) : (
      <>
        <div className="absolute inset-0 bg-[#12151C]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#12151C] via-[#181C26] to-[#1E2430]" />
      </>
    );

  return (
    <>
      {baseAndGradient}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_8%,rgba(11,78,162,0.06),transparent_58%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] bg-[length:48px_48px]"
        aria-hidden
      />
    </>
  );
}
