import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthSession, GoogleOAuthPayload } from '@shared/types/auth';
import { Role } from '@shared/constants/roles';
import { verifyGoogleAuth, logoutSession } from './api';

interface AuthContextType {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: (payload: GoogleOAuthPayload) => Promise<void>;
  signOut: () => Promise<void>;
  setSimulatedRole: (role: Role) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'niva_auth_session_phase1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session on mount if valid
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: AuthSession = JSON.parse(stored);
        if (new Date(parsed.expiresAt) > new Date()) {
          setSession(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = async (payload: GoogleOAuthPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyGoogleAuth(payload);
      setSession(result.session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.session));
    } catch (err: any) {
      const msg = err?.message || 'Google authentication failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    if (session?.token) {
      try {
        await logoutSession(session.token);
      } catch {
        // Ignore network errors on logout
      }
    }
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const setSimulatedRole = (role: Role) => {
    if (!session) return;
    const updated: AuthSession = {
      ...session,
      user: {
        ...session.user,
        role,
      },
    };
    setSession(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session),
        isLoading,
        error,
        signInWithGoogle,
        signOut,
        setSimulatedRole,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
