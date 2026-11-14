import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';
import type { User } from './types';

type SignInResult = 'SIGNED_IN' | 'TWO_FACTOR_REQUIRED';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, totpCode?: string) => Promise<SignInResult>;
  /** Creates the account and signs straight in. */
  register: (username: string, email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Clears local auth state without calling the API (e.g. after account deletion). */
  forgetSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'session_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const forgetSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .me(token)
      .then(setUser)
      .catch(forgetSession)
      .finally(() => setLoading(false));
  }, [token, forgetSession]);

  const signIn = useCallback(
    async (email: string, password: string, totpCode?: string): Promise<SignInResult> => {
      const result = await api.login({
        email,
        password,
        ...(totpCode ? { totpCode } : {}),
      });

      if (result.requiresTwoFactor) return 'TWO_FACTOR_REQUIRED';

      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(result.user);
      setToken(result.token);
      return 'SIGNED_IN';
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      signIn,
      async register(username, email, password) {
        await api.register({ username, email, password });
        return signIn(email, password);
      },
      async signOut() {
        if (token) await api.logout(token).catch(() => undefined);
        forgetSession();
      },
      async refreshUser() {
        if (!token) return;
        setUser(await api.me(token));
      },
      forgetSession,
    }),
    [token, user, loading, signIn, forgetSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
