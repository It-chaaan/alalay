import { ArrowLeft, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { Container } from '../../components/layout/Container';
import { MarketingFooter } from '../../components/layout/MarketingFooter';
import { Navbar } from '../../components/navigation/Navbar';
import { PRIVACY_CONTACT_EMAIL } from '@shared/privacy-policy';

const contactSubject = (label: string) =>
  `mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent(`Alalay ${label}`)}`;

export function ContactPage() {
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
        <div className="mt-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0f8a6b]">
            We’re here to help
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
            Contact Alalay
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Contact us about a technical issue, product feedback, a privacy request, or an
            account-deletion request. Email is the current support channel; there is no contact form
            pretending to deliver a message from this page.
          </p>
          <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#17231f]">
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
              Support email
            </p>
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="mt-2 inline-flex min-h-11 items-center gap-2 break-all text-lg font-semibold text-[#0f8a6b] underline focus:outline-none focus:ring-2 focus:ring-[#0f8a6b]"
            >
              <Mail className="h-5 w-5 shrink-0" aria-hidden="true" /> {PRIVACY_CONTACT_EMAIL}
            </a>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              We’ll review your message and respond when we can. Please do not send passwords,
              authentication codes, API keys, complete financial records, or other highly sensitive
              information by email.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <a
              href={contactSubject('Technical Support')}
              className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#17231f]"
            >
              <Wrench className="h-5 w-5 text-[#0f8a6b]" aria-hidden="true" />
              <h2 className="mt-4 font-semibold text-slate-950 dark:text-slate-100">
                Technical support
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Report a bug or describe a feature that is not working as expected.
              </p>
            </a>
            <a
              href={contactSubject('Privacy or Account Deletion Request')}
              className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#17231f]"
            >
              <ShieldCheck className="h-5 w-5 text-[#0f8a6b]" aria-hidden="true" />
              <h2 className="mt-4 font-semibold text-slate-950 dark:text-slate-100">
                Privacy requests
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Request access, correction, or account and associated-data deletion.
              </p>
            </a>
          </div>
          <p className="mt-8 text-sm leading-6 text-slate-500 dark:text-slate-400">
            For account deletion, use the subject “Alalay Account Deletion Request”. Do not put
            financial details, account identifiers, tokens, or passwords in the email body.
          </p>
        </div>
      </Container>
      <MarketingFooter />
    </main>
  );
}
