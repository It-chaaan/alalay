import type { ReactNode } from "react";
import { dashboardSidebarSections } from "../../constants/dashboard";
import alalayLogo from "../../assets/alalay.svg";

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
      return <svg {...props}><path d="M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6" /></svg>;
    case "bills":
      return <svg {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></svg>;
    case "subscriptions":
      return <svg {...props}><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M4 10h16" /></svg>;
    case "expenses":
      return <svg {...props}><path d="M5 6h14v12H5z" /><path d="M9 10h6M9 14h3" /></svg>;
    case "income":
      return <svg {...props}><path d="M6 18V7m0 0 3 3M6 7 3 10" /><path d="M13 18V9m0 0 3 3m-3-3-3 3" /><path d="M18 18V5" /></svg>;
    case "goals":
      return <svg {...props}><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" /></svg>;
    case "budget":
      return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9 11h6" /></svg>;
    case "reports":
      return <svg {...props}><path d="M5 19V5" /><path d="M5 19h14" /><path d="M8 16v-5M12 16V8M16 16v-7" /></svg>;
    case "assistant":
      return <svg {...props}><path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /></svg>;
    case "scanner":
      return <svg {...props}><path d="M7 4H4v3M20 7V4h-3M4 17v3h3M20 17v3h-3" /><path d="M9 12h6" /></svg>;
    default:
      return <svg {...props}><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" /><path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.4-2.4.5a7.6 7.6 0 0 0-.8-.5l-.4-2.5H10l-.4 2.5a7.6 7.6 0 0 0-.8.5L6.4 9.1l-2 3.4 2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.4 2.4-.5c.2.2.5.3.8.5l.4 2.5h4l.4-2.5c.3-.1.6-.3.8-.5l2.4.5 2-3.4-2-1.5Z" /></svg>;
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
