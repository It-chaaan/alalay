import { useEffect, useState } from "react";

function clearActionParam(actionValue?: string) {
  const url = new URL(window.location.href);

  if (actionValue && url.searchParams.get("action") !== actionValue) {
    return;
  }

  url.searchParams.delete("action");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

export function useActionDialog(actionValue: string) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get("action") === actionValue) {
      setIsOpen(true);
      clearActionParam(actionValue);
    }
  }, [actionValue]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => {
      setIsOpen(false);
      clearActionParam();
    },
  };
}
