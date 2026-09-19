import { useCallback, useEffect, useState } from "react";

export interface Choice {
  variant: string;
  index: number;
  note?: string;
  at: string;
}

export type Choices = Record<string, Choice>;

const KEY = "opencut.proto.choices";
const THEME_KEY = "opencut.proto.theme";

function read(): Choices {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Choices;
  } catch {
    return {};
  }
}

function write(c: Choices) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(c));
    window.dispatchEvent(new Event("proto-choices"));
  } catch {
    /* storage unavailable: choices live in memory for this session only */
  }
}

/** Per-step choices, persisted per browser. */
export function useChoices() {
  const [choices, setChoices] = useState<Choices>({});

  useEffect(() => {
    setChoices(read());
    const sync = () => setChoices(read());
    window.addEventListener("proto-choices", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("proto-choices", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const choose = useCallback((slug: string, variant: string, index: number) => {
    const next = { ...read(), [slug]: { ...read()[slug], variant, index, at: new Date().toISOString() } };
    write(next);
  }, []);

  const setNote = useCallback((slug: string, note: string) => {
    const cur = read();
    const existing = cur[slug];
    if (!existing) return;
    write({ ...cur, [slug]: { ...existing, note } });
  }, []);

  const clear = useCallback((slug: string) => {
    const cur = read();
    delete cur[slug];
    write(cur);
  }, []);

  return { choices, choose, setNote, clear };
}

export type Theme = "dark" | "light";

export function useProtoTheme(fallback: Theme) {
  const [theme, setThemeState] = useState<Theme>(fallback);

  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
    } catch {
      /* ignore */
    }
    const next = stored ?? fallback;
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, [fallback]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme, setTheme };
}
