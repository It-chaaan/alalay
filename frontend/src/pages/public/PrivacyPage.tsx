import { ArrowLeft } from 'lucide-react';
import { Container } from '../../components/layout/Container';
import { MarketingFooter } from '../../components/layout/MarketingFooter';
import { Navbar } from '../../components/navigation/Navbar';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_EFFECTIVE_DATE,
  privacySections,
} from '@shared/privacy-policy';

export function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f2] text-slate-900 dark:bg-[#111a17] dark:text-slate-100">
      <Navbar />
      <Container className="py-16 sm:py-24">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f8a6b] hover:text-[#0b7359] focus:outline-none focus:ring-2 focus:ring-[#0f8a6b] focus:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Alalay
        </a>
        <article className="mt-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0f8a6b]">
            Privacy & trust
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Effective date: {PRIVACY_EFFECTIVE_DATE} · Last updated: {PRIVACY_EFFECTIVE_DATE}
          </p>
          <p className="mt-8 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Alalay is a personal-finance management tool. This policy explains what the current
            application processes, why it is used, and the choices available to you.
          </p>
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
            This notice describes the audited implementation and is not legal advice or a substitute
            for review by a qualified privacy professional.
          </div>
          <div className="mt-12 space-y-10">
            {privacySections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-3 leading-8 text-slate-600 dark:text-slate-300">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-600 dark:text-slate-300">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <p className="mt-12 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Privacy contact:{' '}
            <a
              className="font-semibold text-[#0f8a6b] underline"
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>
          </p>
        </article>
      </Container>
      <MarketingFooter />
    </main>
  );
}
