import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORAGE_KEYS } from '@/constants/secure-storage-keys';
import {
  nextWalletBalanceVisibility,
  walletBalanceVisibilityFromStoredValue,
} from '@/utils/wallet-balance-privacy';

const STORAGE_KEY = SECURE_STORAGE_KEYS.balanceVisibility;
let sharedVisible: boolean | null = null;
let hydrationStarted = false;
const listeners = new Set<(visible: boolean | null) => void>();

async function readVisibility() {
  try {
    const value = Platform.OS === 'web' ? localStorage.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    return walletBalanceVisibilityFromStoredValue(value);
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

/** Shared, persisted privacy preference for wallet balances on Home and Wallet only. */
export function useWalletBalanceVisibility() {
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
    const next = nextWalletBalanceVisibility(sharedVisible);
    sharedVisible = next;
    listeners.forEach((listener) => listener(next));
    void writeVisibility(next);
  };

  return { visible, toggle };
}

/** @deprecated Use useWalletBalanceVisibility to make the preference's scope explicit. */
export const useBalanceVisibility = useWalletBalanceVisibility;
