import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthSession, GoogleOAuthPayload } from '@shared/types/auth';
import { fetchAuthMe, verifyGoogleAuth, logoutSession } from './api';

export type AuthState =
  | 'unauthenticated'
  | 'loading'
  | 'in_progress'
  | 'authenticated'
  | 'error'
  | 'session_expired'
  | 'logged_out';

interface AuthContextType {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStatus: AuthState;
  error: string | null;
  signInWithGoogleRedirect: () => void;
  signInWithGoogle: (payload: GoogleOAuthPayload | { idToken: string } | { credential: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      setAuthStatus('loading');
      const data = await fetchAuthMe();
      const loadedSession: AuthSession = {
        token: 'cookie_session', // Hidden behind HttpOnly cookie
        expiresAt: data.expiresAt,
        user: data.user,
      };
      setSession(loadedSession);
      setAuthStatus('authenticated');
      setError(null);
    } catch {
      setSession(null);
      setAuthStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    // 1. Check URL parameters from Google OAuth redirection
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const authParam = urlParams.get('auth');
      const reason = urlParams.get('reason');

      if (authParam === 'success') {
        window.history.replaceState({}, document.title, window.location.pathname);
        refreshSession();
        return;
      }

      if (authParam === 'unconfigured') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setError(
          'Google Cloud OAuth client credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured in your environment. You can test identity verification or configure real credentials in Settings.',
        );
        setAuthStatus('error');
        return;
      }

      if (authParam === 'error') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setError(`Google authentication failed: ${reason || 'Unknown error'}`);
        setAuthStatus('error');
        return;
      }
    }

    // 2. Validate existing HttpOnly cookie session with server
    refreshSession();
  }, [refreshSession]);

  /**
   * Redirects browser to server-initiated Google OAuth consent screen
   */
  const signInWithGoogleRedirect = () => {
    setAuthStatus('in_progress');
    setError(null);
    window.location.href = '/api/auth/google';
  };

  /**
   * Completes verification with server (Google ID token / GIS / payload)
   */
  const signInWithGoogle = async (
    payload: GoogleOAuthPayload | { idToken: string } | { credential: string },
  ) => {
    setAuthStatus('in_progress');
    setError(null);
    try {
      const result = await verifyGoogleAuth(payload);
      setSession(result.session);
      setAuthStatus('authenticated');
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please verify your credentials.';
      setError(msg);
      setAuthStatus('error');
      throw err;
    }
  };

  /**
   * Securely invalidates server session and clears HttpOnly cookie
   */
  const signOut = async () => {
    try {
      await logoutSession(session?.token);
    } catch {
      // Ignore network errors on logout
    } finally {
      setSession(null);
      setAuthStatus('logged_out');
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        isAuthenticated: Boolean(session),
        isLoading: authStatus === 'loading',
        authStatus,
        error,
        signInWithGoogleRedirect,
        signInWithGoogle,
        signOut,
        refreshSession,
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
