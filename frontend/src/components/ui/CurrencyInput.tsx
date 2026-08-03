import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode } from "react";

function rawValue(value: unknown) {
  return String(value ?? "").replace(/,/g, "").replace(/[^\d.]/g, "");
}

export function formatCurrencyInputValue(value: unknown) {
  const raw = rawValue(value);
  if (!raw) return "";
  const [whole, decimal] = raw.split(".");
  const formattedWhole = (whole || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal.slice(0, 2)}`;
}

function cursorForDigitCount(value: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) seen += 1;
    if (seen >= digitCount) return index + 1;
  }
  return value.length;
}

export function CurrencyInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  name,
  inputRef,
  error,
  helper,
  placeholder = "0.00",
  min,
  step = "0.01",
}: {
  id: string;
  label: string;
  value?: unknown;
  onChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  name?: string;
  inputRef?: (element: HTMLInputElement | null) => void;
  error?: string;
  helper?: ReactNode;
  placeholder?: string;
  min?: string | number;
  step?: string | number;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [displayValue, setDisplayValue] = useState(() => formatCurrencyInputValue(value));

  useEffect(() => {
    setDisplayValue(formatCurrencyInputValue(value));
  }, [value]);

  function setRefs(element: HTMLInputElement | null) {
    ref.current = element;
    inputRef?.(element);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/[^\d.]/g, "");
    const parts = next.split(".");
    const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}` : next;
    const digitsBeforeCursor = next.slice(0, event.target.selectionStart ?? next.length).replace(/\D/g, "").length;
    const formatted = formatCurrencyInputValue(normalized);
    setDisplayValue(formatted);
    onChange(normalized);
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(cursorForDigitCount(formatted, digitsBeforeCursor), cursorForDigitCount(formatted, digitsBeforeCursor));
    });
  }

  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-slate-500">₱</span>
        <input
          ref={setRefs}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={onBlur}
          min={min}
          step={step}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </span>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {!error && helper ? <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div> : null}
    </label>
  );
}
