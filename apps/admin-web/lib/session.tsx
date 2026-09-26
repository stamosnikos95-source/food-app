"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, TokenPair } from "./api";

const ACCESS = "food-admin.accessToken";
const REFRESH = "food-admin.refreshToken";
const BACKOFFICE_ROLES = ["admin", "staff"];

interface Identity { email: string; role: string }

interface SessionState {
  ready: boolean;
  identity: Identity | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  withAuth: <T>(call: (token: string) => Promise<T>) => Promise<T>;
}

const SessionContext = createContext<SessionState | null>(null);

/** Reads the (unverified) JWT payload for display/routing; the API re-verifies everything. */
function identityFrom(token: string | null): Identity | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export class NotStaffError extends Error {}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ACCESS);
    const who = identityFrom(stored);
    if (who && BACKOFFICE_ROLES.includes(who.role)) {
      tokenRef.current = stored;
      setIdentity(who);
    }
    setReady(true);
  }, []);

  const store = useCallback((tokens: TokenPair) => {
    localStorage.setItem(ACCESS, tokens.accessToken);
    localStorage.setItem(REFRESH, tokens.refreshToken);
    tokenRef.current = tokens.accessToken;
    setIdentity(identityFrom(tokens.accessToken));
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    tokenRef.current = null;
    setIdentity(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api.login(email, password);
    const who = identityFrom(tokens.accessToken);
    if (!who || !BACKOFFICE_ROLES.includes(who.role)) {
      api.logout(tokens.refreshToken).catch(() => undefined);
      throw new NotStaffError();
    }
    store(tokens);
  }, [store]);

  const logout = useCallback(() => {
    const refresh = localStorage.getItem(REFRESH);
    clear();
    if (refresh) api.logout(refresh).catch(() => undefined);
  }, [clear]);

  // Single-flight refresh: refresh tokens are single-use server-side.
  const refreshSession = useCallback(() => {
    if (!refreshing.current) {
      refreshing.current = (async () => {
        const refresh = localStorage.getItem(REFRESH);
        if (!refresh) return null;
        try {
          const tokens = await api.refresh(refresh);
          store(tokens);
          return tokens.accessToken;
        } catch (error) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 400)) return null;
          throw error;
        }
      })().finally(() => {
        refreshing.current = null;
      });
    }
    return refreshing.current;
  }, [store]);

  const withAuth = useCallback(async <T,>(call: (token: string) => Promise<T>): Promise<T> => {
    if (tokenRef.current) {
      try {
        return await call(tokenRef.current);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
      }
    }
    const fresh = await refreshSession();
    if (!fresh) {
      clear();
      throw new ApiError("Session expired", 401);
    }
    return call(fresh);
  }, [refreshSession, clear]);

  const value = useMemo(
    () => ({ ready, identity, isAdmin: identity?.role === "admin", login, logout, withAuth }),
    [ready, identity, login, logout, withAuth],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
