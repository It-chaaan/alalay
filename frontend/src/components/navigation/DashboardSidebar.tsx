import type { ReactNode } from "react";
import { dashboardSidebarSections } from "../../constants/dashboard";
import alalayLogo from "../../assets/alalay.svg";
import {LayoutDashboard, ReceiptText, CreditCard, BanknoteArrowDown, BanknoteArrowUp, HandCoins, Wallet, Summary, Bot, Scan, Settings } from "lucide-react";

type DashboardSidebarProps = {
  activeLabel: string;
  name: string;
  onSignOut: () => void;
  footerNote?: ReactNode;
};

function SidebarIcon({ type }: { type: string }) {
  const common = "h-4 w-4";
  const props = { "aria-hidden": true, viewBox: "0 0 24 24", className: common, fill: "none", stroke: "currentColor", strokeWidth: "1.8" as const };

  switch (type) {
    case "dashboard":
      return <LayoutDashboard {...props} />;
    case "bills":
      return <ReceiptText {...props} />;
    case "subscriptions":
      return <CreditCard {...props} />;
    case "expenses":
      return <BanknoteArrowDown {...props} />;
    case "income":
      return <BanknoteArrowUp {...props} />;
    case "goals":
      return <HandCoins {...props} />;
    case "budget":
      return <Wallet {...props} />;
    case "reports":
      return <Summary {...props} />;
    case "assistant":
      return <Bot {...props} />;
    case "scanner":
      return <Scan {...props} />;
    default:
      return <Settings {...props} />;
  }
}

export function DashboardSidebar({ activeLabel, name, onSignOut, footerNote }: DashboardSidebarProps) {
  return (
    <aside className="hidden min-h-screen w-[228px] shrink-0 border-r border-slate-200 bg-[#fbfbf8] lg:flex lg:flex-col">
      <div className="flex h-[68px] items-center gap-3 border-b border-slate-200/80 px-5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-primary text-white shadow-sm">
          <img src={alalayLogo} alt="Alalay logo" className="h-7 w-7 object-contain" />
        </span>
        <span className="text-sm font-semibold text-slate-950">Alalay</span>
      </div>

      <nav className="flex-1 px-4 py-4">
        <div className="space-y-3">
          {dashboardSidebarSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className={sectionIndex > 0 ? "border-t border-slate-200/80 pt-3" : ""}>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = item.label === activeLabel;

                  return (
                    <a
                      key={item.label}
                      href={item.path}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                        isActive ? "bg-[#dff4ed] text-brand-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`grid h-4 w-4 place-items-center transition ${isActive ? "text-brand-primary" : "text-slate-400 group-hover:text-slate-600"}`}>
                          <SidebarIcon type={item.icon} />
                        </span>
                        <span className="font-medium">{item.label}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200/80 p-4">
        <div className="p-1">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-primary text-xs font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-950">{name}</p>
              <p className="mt-1 w-fit rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Free plan</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label="Sign out"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
          {footerNote}
        </div>
      </div>
    </aside>
  );
}
