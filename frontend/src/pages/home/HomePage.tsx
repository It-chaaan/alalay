import alalayLogo from "../../assets/alalay.svg";
import { Container } from "../../components/layout/Container";
import { Navbar } from "../../components/navigation/Navbar";
import { mobileDownloadCopy, qrPreviewCells } from "../../constants/mobileDownload";

const features = [
  {
    title: "Bill tracking",
    description:
      "Never miss a due date again. Get reminders 3 days before, day-of, and instant overdue alerts.",
  },
  {
    title: "AI financial companion",
    description:
      "Ask Alalay anything in English or Filipino. Get personalized insights, spending analysis, and actionable tips.",
  },
  {
    title: "Savings goals",
    description:
      "Set a target, track your progress, and let Alalay tell you exactly how much to save each month to hit your goal.",
  },
  {
    title: "Expense analytics",
    description:
      "Visualize where your money goes with clean charts. Spot patterns, find leaks, and build better habits month over month.",
  },
  {
    title: "Subscription audit",
    description:
      "Alalay watches recurring charges and flags unused subscriptions. One tap to cancel what you no longer need.",
  },
  {
    title: "OCR receipt scanning",
    description:
      "Point your camera at any receipt. Alalay reads it and logs the expense automatically with no manual entry.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your account",
    copy:
      "Sign up in 30 seconds. Choose your billers from common Philippine utilities, telcos, and government services.",
  },
  {
    number: "02",
    title: "Add your bills & income",
    copy:
      "Tell Alalay your monthly income and recurring bills. It calculates your budget automatically with no spreadsheets needed.",
  },
  {
    number: "03",
    title: "Let Alalay guide you",
    copy:
      "Get proactive reminders, spending insights in Tagalog or English, and savings recommendations tailored to your situation.",
  },
];

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M12 3v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function QrPreview() {
  return (
    <div className="grid h-20 w-20 grid-cols-8 grid-rows-8 gap-1 rounded-2xl bg-white p-2">
      {qrPreviewCells.map((cell, index) => (
        <span key={index} className={`rounded-[3px] bg-brand-deep ${cell}`} />
      ))}
    </div>
  );
}

function MobileAppSoonSection() {
  return (
    <section className="bg-brand-deep px-4 py-20 text-white sm:px-6 lg:px-8">
      <Container>
        <div className="grid gap-12 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-brand-panel via-brand-dark to-brand-deep p-8 shadow-glow sm:p-12 lg:grid-cols-[0.95fr_1.05fr] lg:p-16">
          <div className="flex flex-col justify-center">
            <p className="mb-5 inline-flex w-fit rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white/75">
              {mobileDownloadCopy.apkStatus}
            </p>
            <h2 className="max-w-md text-4xl font-bold leading-tight text-white sm:text-5xl">
              {mobileDownloadCopy.heading}
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">
              {mobileDownloadCopy.description}
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                disabled
                className="inline-flex min-h-16 items-center justify-center gap-3 rounded-3xl bg-white px-7 py-4 text-lg font-bold text-brand-deep opacity-95 shadow-sm"
              >
                <DownloadIcon />
                <span>{mobileDownloadCopy.apkLabel}</span>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
                  Soon
                </span>
              </button>

              <div className="flex min-h-16 items-center gap-4 rounded-3xl border border-white/10 bg-white/10 px-5 py-4">
                <QrPreview />
                <div>
                  <div className="font-bold text-white">{mobileDownloadCopy.qrTitle}</div>
                  <p className="mt-1 max-w-[10rem] text-sm leading-5 text-white/65">
                    {mobileDownloadCopy.qrDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-glow backdrop-blur-md sm:p-10">
              <div className="flex items-start gap-6">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.75rem] bg-white/15 ring-1 ring-white/10">
                  <img src={alalayLogo} alt="" className="h-16 w-16 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold tracking-[0.28em] text-white/45">
                      {mobileDownloadCopy.notificationSource}
                    </p>
                    <p className="text-sm font-semibold text-white/35">
                      {mobileDownloadCopy.notificationTime}
                    </p>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                    {mobileDownloadCopy.notificationTitle}
                  </h3>
                </div>
              </div>
              <p className="mt-8 text-lg font-semibold leading-8 text-white/70">
                {mobileDownloadCopy.notificationBody}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8f7f2] text-slate-900">
      <Navbar />

      <section
        id="top"
        className="relative flex min-h-[calc(100vh-4rem)] overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(2,132,108,0.10),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(18,164,129,0.14),transparent_18%)]" />
        <Container className="relative grid flex-1 items-center gap-14 py-16 lg:grid-cols-2 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Pangalagaan ang iyong <span className="text-[#0f8a6b]">pera</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Alalay is an AI-powered finance app built for Filipinos. Track bills,
              manage subscriptions, hit savings goals, all in one calm, intelligent
              dashboard.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href="#signup"
                className="inline-flex items-center justify-center rounded-full bg-[#0f8a6b] px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-[#0b7359]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-5 w-5"
                >
                  <path d="M12 3v11" />
                  <path d="m7 11 5 5 5-5" />
                  <path d="M5 20h14" />
                </svg>
                Get the App
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-4 font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Start for free <span className="ml-2">→</span>
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[360px] rounded-[2rem] border border-black/5 bg-white p-4 shadow-[0_30px_80px_rgba(9,62,51,0.18)]">
              <div className="flex items-center gap-2 border-b border-black/5 pb-4">
                <div className="mx-auto w-40 rounded-full bg-slate-100 py-1 text-center text-[11px] text-slate-400">
                  app.alalay.ph
                </div>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4 p-3">
                <aside className="space-y-3 text-sm text-slate-500">
                  <div className="flex items-center gap-2 rounded-xl bg-[#e3f6ef] px-3 py-2 font-medium text-[#0b7b62]">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-[#0f8a6b]">
                      <img
                        src={alalayLogo}
                        alt="Alalay Logo"
                        className="h-3.5 w-3.5"
                      />
                    </span>
                    Alalay
                  </div>
                  {["Dashboard", "Bills", "Expenses", "Savings", "AI Assistant"].map(
                    (item, index) => (
                      <div
                        key={item}
                        className={`rounded-xl px-3 py-2 ${
                          index === 0 ? "bg-[#dff2eb] font-medium text-[#0b7b62]" : ""
                        }`}
                      >
                        {item}
                      </div>
                    ),
                  )}
                </aside>
                <section className="space-y-3">
                  <div className="text-lg font-semibold text-slate-700">
                    Good morning, Christian
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Bills", "₱4,599"],
                      ["Due soon", "₱3,699"],
                      ["Expenses", "₱14,086"],
                      ["Savings", "48%"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm"
                      >
                        <div className="text-slate-400">{label}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-800">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </Container>
      </section>


      <section id="features" className="bg-[#fbfaf6] py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Everything you need to take control
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Built for the way Filipinos actually manage money, multiple billers,
              mixed payments, bilingual support.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[24px] border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f6ef] text-[#0f8a6b]">
                  ✦
                </div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="bg-[#e8f6f0] py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Handa ka in 3 minutes
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              No complicated setup. Just open and go.
            </p>
          </div>
          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f8a6b] font-mono text-lg font-semibold text-white">
                  {step.number}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
                  {step.copy}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="signup" className="bg-[#0f6f57] py-24 text-white">
        <Container className="flex flex-col items-center text-center">
          <div className="mb-6 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white/15 p-1 ring-1 ring-white/10">
            <img src={alalayLogo} alt="Alalay logo" className="h-full w-full object-cover" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simulan na natin.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/85">
            Join thousands of Filipinos who finally know where their money goes.
            Free to start, no credit card needed.
          </p>
          <a
            href="/register"
            className="mt-10 inline-flex items-center justify-center rounded-full bg-white px-7 py-4 font-semibold text-[#0f6f57] transition hover:bg-slate-100"
          >
            Create your free account →
          </a>
        </Container>
      </section>

      <MobileAppSoonSection />

      <footer className="bg-[#f8f7f2] pb-8 pt-16">
        <Container>
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div className="max-w-sm">
              <div className="flex items-center gap-3 font-semibold text-slate-950">
                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
                  <img src={alalayLogo} alt="Alalay logo" className="h-full w-full object-cover" />
                </span>
                <span>Alalay</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Your AI-powered financial companion for bills, savings, and
                spending clarity in the Philippines.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">Product</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>
                  <a href="#features" className="transition hover:text-[#0f8a6b]">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="transition hover:text-[#0f8a6b]">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#signup" className="transition hover:text-[#0f8a6b]">
                    Get started
                  </a>
                </li>
                <li>
                  <a href="#demo" className="transition hover:text-[#0f8a6b]">
                    Demo
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">Company</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>
                  <a href="#privacy" className="transition hover:text-[#0f8a6b]">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#terms" className="transition hover:text-[#0f8a6b]">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#updates" className="transition hover:text-[#0f8a6b]">
                    Updates
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">Support</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>
                  <a href="#help-center" className="transition hover:text-[#0f8a6b]">
                    Help center
                  </a>
                </li>
                <li>
                  <a href="#contact" className="transition hover:text-[#0f8a6b]">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#status" className="transition hover:text-[#0f8a6b]">
                    Status
                  </a>
                </li>
                <li>
                  <a href="#community" className="transition hover:text-[#0f8a6b]">
                    Community
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 border-t border-black/5 pt-6">
            <div className="flex flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2025 Alalay. Made with care in the Philippines.</p>
              <p>PH</p>
            </div>
          </div>
        </Container>
      </footer>
    </main>
  );
}
