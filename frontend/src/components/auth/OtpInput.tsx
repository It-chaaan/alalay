import { useEffect, useRef } from "react";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function updateDigit(index: number, nextDigit: string) {
    const nextValue = digits.slice();
    nextValue[index] = nextDigit.replace(/\D/g, "").slice(-1);
    onChange(nextValue.join(""));
    if (nextValue[index] && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleChange(index: number, nextValue: string) {
    const numericValue = nextValue.replace(/\D/g, "");
    if (numericValue.length > 1) {
      const nextDigits = digits.slice();
      numericValue.slice(0, 6 - index).split("").forEach((digit, offset) => {
        nextDigits[index + offset] = digit;
      });
      onChange(nextDigits.join(""));
      inputRefs.current[Math.min(index + numericValue.length, 5)]?.focus();
      return;
    }
    updateDigit(index, numericValue);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      updateDigit(index - 1, "");
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6 - index);
    if (!pasted) return;
    const nextDigits = digits.slice();
    pasted.split("").forEach((digit, offset) => {
      nextDigits[index + offset] = digit;
    });
    onChange(nextDigits.join(""));
    inputRefs.current[Math.min(index + pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          aria-label={`Digit ${index + 1} of 6`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="h-14 w-12 rounded-2xl border border-slate-200 bg-white text-center text-xl font-bold text-slate-950 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 disabled:cursor-not-allowed disabled:bg-slate-100 sm:w-14"
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          pattern="[0-9]*"
          type="text"
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
        />
      ))}
    </div>
  );
}
