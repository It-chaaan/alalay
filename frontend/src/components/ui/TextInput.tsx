import type { InputHTMLAttributes, ReactNode } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  labelClassName?: string;
  error?: string;
  rightSlot?: ReactNode;
};

export function TextInput({
  id,
  label,
  labelClassName = "",
  error,
  rightSlot,
  className = "",
  ...props
}: TextInputProps) {
  return (
    <div>
      <label htmlFor={id} className={`mb-2 block text-sm font-semibold text-slate-800 ${labelClassName}`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${rightSlot ? "pr-16" : ""} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {rightSlot ? <div className="absolute inset-y-0 right-3 flex items-center">{rightSlot}</div> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
