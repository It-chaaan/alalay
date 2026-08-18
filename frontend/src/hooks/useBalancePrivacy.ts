import { useEffect, useState } from 'react';

const storageKey = 'alalay-wallet-balances-hidden';
const visibilityEvent = 'alalay-wallet-balance-visibility';

function readHidden() {
  try {
    return window.localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

export function useBalancePrivacy() {
  const [isPrivate, setIsPrivate] = useState(readHidden);

  useEffect(() => {
    const sync = () => setIsPrivate(readHidden());
    window.addEventListener('storage', sync);
    window.addEventListener(visibilityEvent, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(visibilityEvent, sync);
    };
  }, []);

  function togglePrivacy() {
    const next = !isPrivate;
    setIsPrivate(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
      window.dispatchEvent(new Event(visibilityEvent));
    } catch {
      // Privacy still applies for this view when storage is unavailable.
    }
  }

  return { isPrivate, togglePrivacy };
}
