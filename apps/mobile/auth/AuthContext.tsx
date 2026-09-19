import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { tokenStorage } from "./tokenStorage";

interface AuthState {
  isLoading: boolean;
  accessToken: string | null;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ACCESS_TOKEN_KEY = "food-app.accessToken";
const REFRESH_TOKEN_KEY = "food-app.refreshToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    tokenStorage.getItem(ACCESS_TOKEN_KEY).then((stored) => {
      setAccessToken(stored);
      setIsLoading(false);
    });
  }, []);

  async function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
    await tokenStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    await tokenStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
  }

  async function register(email: string, password: string) {
    const tokens = await api.register(email, password);
    await persistTokens(tokens);
  }

  async function login(email: string, password: string) {
    const tokens = await api.login(email, password);
    await persistTokens(tokens);
  }

  async function logout() {
    await tokenStorage.removeItem(ACCESS_TOKEN_KEY);
    await tokenStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider value={{ isLoading, accessToken, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
