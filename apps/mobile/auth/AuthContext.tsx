import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, ApiError, TokenPair } from "../api/client";
import { tokenStorage } from "./tokenStorage";

interface AuthState {
  isLoading: boolean;
  isSignedIn: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Runs an authenticated API call. If the access token has expired (401),
   * refreshes the session once and retries; if the session can't be
   * refreshed, signs the user out instead of leaving a dead screen.
   */
  withAuth: <T>(call: (accessToken: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ACCESS_TOKEN_KEY = "food-app.accessToken";
const REFRESH_TOKEN_KEY = "food-app.refreshToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  // Refs, not state: withAuth must always see the latest token without
  // changing identity (screens use it as an effect dependency).
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    tokenStorage
      .getItem(ACCESS_TOKEN_KEY)
      .then((stored) => {
        accessTokenRef.current = stored;
        setIsSignedIn(Boolean(stored));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persistTokens = useCallback(async (tokens: TokenPair) => {
    await tokenStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    await tokenStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    accessTokenRef.current = tokens.accessToken;
    setIsSignedIn(true);
  }, []);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    await tokenStorage.removeItem(ACCESS_TOKEN_KEY);
    await tokenStorage.removeItem(REFRESH_TOKEN_KEY);
    setIsSignedIn(false);
  }, []);

  const refreshSession = useCallback((): Promise<string | null> => {
    // Single-flight: refresh tokens are single-use on the server, so
    // parallel 401s must share one refresh. A second refresh with the same
    // token would be seen as token theft and end every session.
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        const refreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return null;
        try {
          const tokens = await api.refresh(refreshToken);
          await persistTokens(tokens);
          return tokens.accessToken;
        } catch (error) {
          // 401: revoked/expired/unknown. 400: malformed (e.g. a token from
          // before refresh rotation existed). Either way the session is over.
          if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 400)) {
            return null;
          }
          throw error; // Network trouble: keep the session, surface the error.
        }
      })().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return refreshInFlight.current;
  }, [persistTokens]);

  const withAuth = useCallback(
    async <T,>(call: (accessToken: string) => Promise<T>): Promise<T> => {
      const token = accessTokenRef.current;
      if (token) {
        try {
          return await call(token);
        } catch (error) {
          if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
        }
      }
      const freshToken = await refreshSession();
      if (!freshToken) {
        await clearSession();
        throw new ApiError("Session expired", 401);
      }
      return call(freshToken);
    },
    [refreshSession, clearSession],
  );

  const register = useCallback(
    async (email: string, password: string) => persistTokens(await api.register(email, password)),
    [persistTokens],
  );

  const login = useCallback(
    async (email: string, password: string) => persistTokens(await api.login(email, password)),
    [persistTokens],
  );

  const logout = useCallback(async () => {
    const refreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);
    await clearSession();
    // Best effort: revoke server-side so the token can't be reused.
    if (refreshToken) api.logout(refreshToken).catch(() => undefined);
  }, [clearSession]);

  const value = useMemo(
    () => ({ isLoading, isSignedIn, register, login, logout, withAuth }),
    [isLoading, isSignedIn, register, login, logout, withAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
