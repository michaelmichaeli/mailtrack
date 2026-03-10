"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import en, { type TranslationKey } from "./en";

type Translations = Record<TranslationKey, string>;

interface I18nContextType {
  t: (key: TranslationKey) => string;
  locale: string;
  setLocale: (locale: string) => void;
}

const I18nContext = createContext<I18nContextType>({
  t: (key) => en[key] ?? key,
  locale: "en",
  setLocale: () => {},
});

const translationCache: Record<string, Translations> = { en };

async function loadTranslations(locale: string): Promise<Translations> {
  if (translationCache[locale]) return translationCache[locale];
  try {
    const mod = await import(`./${locale}.ts`);
    translationCache[locale] = mod.default;
    return mod.default;
  } catch {
    return en;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState("en");
  const [translations, setTranslations] = useState<Translations>(en);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("mailtrack_language") ?? "en" : "en";
    setLocaleState(saved);
    loadTranslations(saved).then(setTranslations);
    document.documentElement.lang = saved;
    document.documentElement.dir = saved === "he" || saved === "ar" ? "rtl" : "ltr";
  }, []);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    localStorage.setItem("mailtrack_language", newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "he" || newLocale === "ar" ? "rtl" : "ltr";
    loadTranslations(newLocale).then(setTranslations);
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return translations[key] ?? en[key] ?? key;
  }, [translations]);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { TranslationKey };
