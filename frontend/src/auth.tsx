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
  signIn: (email: string, password: string) => Promise<void>;
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
      async signIn(email, password) {
        const result = await api.login({ email, password });
        localStorage.setItem('session_token', result.token);
        setToken(result.token);
        setUser(result.user);
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
  });
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
        await auth.signIn(form.email, form.password);
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
    submit,
  };
}
