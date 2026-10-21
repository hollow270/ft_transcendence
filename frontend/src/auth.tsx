import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';
import type { User } from './types';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    totpCode?: string,
  ) => Promise<'SIGNED_IN' | 'TWO_FACTOR_REQUIRED'>;
  register: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('session_token'),
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

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
      .catch(() => {
        localStorage.removeItem('session_token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      async signIn(email, password, totpCode) {
        const result = await api.login({
          email,
          password,
          ...(totpCode ? { totpCode } : {}),
        });

        if (result.requiresTwoFactor) {
          return 'TWO_FACTOR_REQUIRED';
        }

        localStorage.setItem('session_token', result.token);
        setToken(result.token);
        setUser(result.user);
        return 'SIGNED_IN';
      },
      async register(username, email, password) {
        await api.register({ username, email, password });
      },
      async signOut() {
        if (token) {
          await api.logout(token).catch(() => undefined);
        }
        localStorage.removeItem('session_token');
        setToken(null);
        setUser(null);
      },
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}

export function useAuthForm() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    totpCode: '',
  });
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (mode === 'register') {
        await auth.register(form.username, form.email, form.password);
        setMessage('Account created. You can sign in now.');
        setMode('login');
      } else {
        const result = await auth.signIn(
          form.email,
          form.password,
          form.totpCode,
        );

        if (result === 'TWO_FACTOR_REQUIRED') {
          setTwoFactorRequired(true);
          setMessage('Enter the 6-digit code from your authenticator app.');
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return {
    mode,
    setMode,
    form,
    setForm,
    busy,
    message,
    twoFactorRequired,
    submit,
  };
}
