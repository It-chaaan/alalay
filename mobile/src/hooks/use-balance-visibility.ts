import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'alalay-balance-visibility';

async function readVisibility() {
  try {
    const value = Platform.OS === 'web' ? localStorage.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    return value === 'hidden' ? false : true;
  } catch {
    return true;
  }
}

async function writeVisibility(visible: boolean) {
  try {
    if (Platform.OS === 'web') await Promise.resolve(localStorage.setItem(STORAGE_KEY, visible ? 'visible' : 'hidden'));
    else await SecureStore.setItemAsync(STORAGE_KEY, visible ? 'visible' : 'hidden');
  } catch {
    // Privacy preference persistence is best effort; financial data is never stored here.
  }
}

export function useBalanceVisibility() {
  const [visible, setVisible] = useState<boolean | null>(null);
  useEffect(() => { void readVisibility().then(setVisible); }, []);

  const toggle = () => {
    setVisible((current) => {
      const next = current === false;
      void writeVisibility(next);
      return next;
    });
  };

  return { visible, toggle };
}
