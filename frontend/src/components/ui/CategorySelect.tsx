import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { getCategoryDefinition } from "../../utils/categoryDefinitions";
import { CategoryIcon } from "./CategoryIcon";

export function CategorySelect({ id, label, value, options, onChange, error }: { id: string; label: string; value: string; options: string[]; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const selected = value ? getCategoryDefinition(value) : null;
  return <div className="relative">
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">{label}</label>
    <button id={id} type="button" onClick={() => setOpen((current) => !current)} className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-950 outline-none transition hover:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" aria-expanded={open}>
      <span className="flex items-center gap-2 text-sm">{selected ? <><CategoryIcon category={value} />{selected.name}</> : <span className="px-1 text-slate-400">Select category</span>}</span><ChevronDown className="h-4 w-4 text-slate-400" />
    </button>
    {open ? <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{options.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-brand-soft"><CategoryIcon category={option} />{getCategoryDefinition(option).name}</button>)}</div> : null}
    {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
  </div>;
}
