import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, setUnauthorizedHandler, type User } from "./api";
import { clearToken, getToken, setToken } from "./token";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, inviteCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await api.me();
          if (!cancelled) {
            setUser(me);
          }
        }
      } catch {
        await clearToken();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await api.tokenLogin(username, password);
    await setToken(result.token);
    setUser(result.user);
  }, []);

  const signUp = useCallback(async (username: string, password: string, inviteCode?: string) => {
    await api.register(username, password, inviteCode);
    const result = await api.tokenLogin(username, password);
    await setToken(result.token);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors during logout.
    }
    await clearToken();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await api.me();
    setUser(me);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
