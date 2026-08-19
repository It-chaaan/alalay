import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultSettings, readAppSettings, settingsChangedEvent, type AppSettings } from "../lib/appSettings";

const PreferencesContext = createContext<{ settings: AppSettings; refresh: () => void }>({
  settings: defaultSettings,
  refresh: () => undefined,
});

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readAppSettings);

  useEffect(() => {
    const refresh = () => setSettings(readAppSettings());
    window.addEventListener(settingsChangedEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(settingsChangedEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  return <PreferencesContext.Provider value={{ settings, refresh: () => setSettings(readAppSettings()) }}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  return useContext(PreferencesContext);
}
