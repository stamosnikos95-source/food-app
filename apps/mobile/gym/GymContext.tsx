import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { api, GymInfo } from "../api/client";

/** The partner gym a customer arrived from (QR scan), kept for a few hours. */
export interface ActiveGym extends GymInfo {
  code: string;
}

const KEY = "food-app.gym";
const TTL_MS = 12 * 60 * 60 * 1000;
const web = Platform.OS === "web" && typeof window !== "undefined";
let memory: { gym: ActiveGym; savedAt: number } | null = null; // native fallback until deep links

function readSaved(): ActiveGym | null {
  try {
    const raw = web ? window.localStorage.getItem(KEY) : memory ? JSON.stringify(memory) : null;
    if (!raw) return null;
    const saved = JSON.parse(raw) as { gym: ActiveGym; savedAt: number };
    return Date.now() - saved.savedAt < TTL_MS ? saved.gym : null;
  } catch {
    return null;
  }
}

function write(gym: ActiveGym | null) {
  const entry = gym ? { gym, savedAt: Date.now() } : null;
  memory = entry;
  if (!web) return;
  try {
    if (entry) window.localStorage.setItem(KEY, JSON.stringify(entry));
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the in-memory copy still works for this visit
  }
}

/** Takes ?gym=CODE from the address bar once, leaving any other parameters. */
function consumeCodeFromUrl(): string | null {
  if (!web) return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("gym");
  if (!code) return null;
  params.delete("gym");
  const rest = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  return /^[a-z0-9]{6,32}$/i.test(code) ? code.toLowerCase() : null;
}

interface GymState {
  gym: ActiveGym | null;
  clear: () => void;
}

const Ctx = createContext<GymState>({ gym: null, clear: () => undefined });

export function GymProvider({ children }: { children: ReactNode }) {
  const [gym, setGym] = useState<ActiveGym | null>(() => readSaved());

  useEffect(() => {
    const code = consumeCodeFromUrl();
    if (!code) return;
    api
      .lookupGym(code)
      .then((r) => {
        const active = { ...r.gym, code: r.code };
        write(active);
        setGym(active);
      })
      .catch(() => {
        write(null);
        setGym(null);
      });
  }, []);

  const clear = useCallback(() => {
    write(null);
    setGym(null);
  }, []);

  return <Ctx.Provider value={{ gym, clear }}>{children}</Ctx.Provider>;
}

export const useGym = () => useContext(Ctx);
