import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PortalBackgroundLayers } from '../../components/layout/PortalBackground';
import { getPrivacyFooterLines, privacyPolicySections } from '../../content/privacyPolicyContent';

export default function PrivacyPage() {
  const { versionLine, updatedLine } = getPrivacyFooterLines();

  return (
    <div className="relative min-h-screen bg-[var(--portal-app-bg)] text-slate-900">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <PortalBackgroundLayers />
      </div>
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#0B4EA2]"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al login
          </Link>
        </div>

        <header className="mb-10 border-b border-slate-200/90 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]/90">FIMASS by Sportello Amico</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Informativa Privacy</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Documento informativo sul trattamento dei dati personali nell’ambito del portale per servizi assicurativi.
            Testo placeholder professionale: sostituire con il testo legale definitivo dal Titolare.
          </p>
        </header>

        <div className="space-y-10">
          {privacyPolicySections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                {section.paragraphs.map((p, i) => (
                  <p key={`${section.id}-${i}`}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-slate-200/90 pt-8 text-sm text-slate-500">
          <p className="font-medium text-slate-700">{versionLine}</p>
          <p className="mt-1">{updatedLine}</p>
        </footer>
      </div>
    </div>
  );
}
