import alalayLogo from "../../assets/alalay.svg";
import { Container } from "./Container";

const productLinks = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Get started", href: "/#signup" },
  { label: "Demo", href: "/#demo" },
];

export function MarketingFooter() {
  return (
    <footer className="bg-[#f8f7f2] pb-8 pt-16 dark:bg-[#111a17]">
      <Container>
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_auto] lg:gap-24">
          <div className="max-w-sm">
            <div className="flex items-center gap-3 font-semibold text-slate-950 dark:text-slate-100">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
                <img src={alalayLogo} alt="Alalay logo" className="h-full w-full object-cover" />
              </span>
              <span>Alalay</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Take control of your bills, savings, and spending in the Philippines, with an AI assistant whenever you need guidance.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Product</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              {productLinks.map((item) => <li key={item.label}><a href={item.href} className="transition hover:text-[#0f8a6b]">{item.label}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-14 border-t border-black/5 pt-6 dark:border-white/10">
          <div className="flex flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><p>© 2026 Alalay.</p><a href="/privacy" className="transition hover:text-[#0f8a6b]">Privacy</a><a href="/contact" className="transition hover:text-[#0f8a6b]">Contact</a></div>
            <p>It_chaaan</p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
