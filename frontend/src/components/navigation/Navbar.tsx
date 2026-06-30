import alalayLogo from "../../assets/alalay.svg";

const navItems = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3 font-semibold">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#0f8a6b] shadow-sm ring-1 ring-black/5">
            <img src={alalayLogo} alt="Alalay logo" className="h-7 w-7 object-contain" />
          </span>
          <span className="text-[1.05rem] tracking-tight">Alalay</span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-slate-500 md:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-slate-900">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 text-sm">
          <a href="/login" className="font-medium text-[#0f8a6b]">
            Log in
          </a>
          <a
            href="/register"
            className="inline-flex items-center rounded-full bg-[#0f8a6b] px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#0b7359]"
          >
            Get started free
          </a>
        </div>
      </div>
    </header>
  );
}
