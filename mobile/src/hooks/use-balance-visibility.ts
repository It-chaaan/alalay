import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'alalay-balance-visibility';
let sharedVisible: boolean | null = null;
let hydrationStarted = false;
const listeners = new Set<(visible: boolean | null) => void>();

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
  const [visible, setVisible] = useState<boolean | null>(sharedVisible);
  useEffect(() => {
    listeners.add(setVisible);
    if (!hydrationStarted) {
      hydrationStarted = true;
      void readVisibility().then((next) => {
        sharedVisible = next;
        listeners.forEach((listener) => listener(next));
      });
    }
    return () => { listeners.delete(setVisible); };
  }, []);

  const toggle = () => {
    const next = sharedVisible === false;
    sharedVisible = next;
    listeners.forEach((listener) => listener(next));
    void writeVisibility(next);
  };

  return { visible, toggle };
}
