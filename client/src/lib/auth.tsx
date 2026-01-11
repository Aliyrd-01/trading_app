import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { queryClient } from './queryClient';

type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const API_BASE_URL = '/api';

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const text = await response.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      const errorWithCode = new Error('Login failed') as Error & { code?: string; email?: string };
      if (payload && typeof payload === 'object') {
        errorWithCode.code = payload.code;
        errorWithCode.email = payload.email;

        const emailErrors: string[] = Array.isArray(payload.errors?.email) ? payload.errors.email : [];
        const invalidCreds = emailErrors.some((m) => typeof m === 'string' && m.includes('credentials are incorrect'));
        if (invalidCreds) {
          errorWithCode.code = 'INVALID_CREDENTIALS';
          errorWithCode.message = 'Invalid credentials';
        } else {
          errorWithCode.message = payload.error || payload.message || 'Login failed';
        }
      } else {
        errorWithCode.message = text || `HTTP ${response.status}`;
      }

      throw errorWithCode;
    }

    const userData = await response.json();
    queryClient.clear();
    setUser(userData);
    setLocation('/dashboard');
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name: (name ?? '').trim() }),
    });

    if (!response.ok) {
      const text = await response.text();
      let msg = '';
      try {
        const payload: any = text ? JSON.parse(text) : null;
        const emailErr = Array.isArray(payload?.errors?.email) ? payload.errors.email[0] : null;
        msg = (emailErr || payload?.error || payload?.message || '').toString();
      } catch {
        const m = (text || '').match(/"error"\s*:\s*"([^"]+)"/);
        msg = m?.[1] || '';
      }

      throw new Error(msg || 'Registration failed');
    }

    const userData = await response.json();
    queryClient.clear();
    setUser(userData);
    setLocation('/dashboard');
  };

  const logout = async () => {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });
    queryClient.clear();
    setUser(null);
    setLocation('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
