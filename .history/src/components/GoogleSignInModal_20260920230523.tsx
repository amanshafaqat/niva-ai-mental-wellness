import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getGoogleAuthUrl } from '../lib/api';
import { GoogleOAuthPayload } from '@shared/types/auth';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { signInWithGoogle, signInWithGoogleRedirect, isLoading, error, clearError } = useAuth();
  const [googleOAuthConfig, setGoogleOAuthConfig] = useState<{
    configured: boolean;
    url: string | null;
    clientId: string | null;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      getGoogleAuthUrl()
        .then(setGoogleOAuthConfig)
        .catch(() => setGoogleOAuthConfig({ configured: false, url: null, clientId: null }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthPayload = async (payload: GoogleOAuthPayload) => {
    try {
      await signInWithGoogle(payload);
      onSuccess();
      onClose();
    } catch {
      // Error is caught and surfaced in AuthContext
    }
  };

  const handleLocalDemoSignIn = () =>
    handleAuthPayload({
      sub: 'local-demo-user',
      email: 'local@demo.niva',
      email_verified: true,
      name: 'Local Demo User',
      picture:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });

  return (
    <div
      id="google-signin-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 id="signin-modal-title" className="text-xl font-semibold text-stone-900">
                Sign in to NIVA
              </h3>
              <p className="text-xs text-stone-600">Private access to your wellness dashboard</p>
            </div>
          </div>
          <button
            onClick={() => {
              clearError();
              onClose();
            }}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 leading-relaxed">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-800 mt-0.5" />
            <div>
              <p className="font-semibold text-stone-900">Zero Password Footprint</p>
              <p className="mt-0.5">
                NIVA has no password fields, no password hashing, and no password database. Identity is verified strictly via Google OAuth 2.0 and secured with HttpOnly cookies.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {googleOAuthConfig?.configured ? (
            <div>
              <p className="text-xs text-stone-600 mb-3">
                Google sign-in is active for this environment. Continue below to access your protected wellness area.
              </p>
              <button
                id="google-continue-button"
                disabled={isLoading}
                onClick={signInWithGoogleRedirect}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white py-3 px-4 text-sm font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 leading-relaxed">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Google sign-in is not configured in this local environment</p>
                    <p className="mt-0.5">
                      Add the Google OAuth credentials to your server environment to enable live sign-in, or continue with the local demo account below for testing.
                    </p>
                  </div>
                </div>
              </div>

              <button
                id="demo-local-signin-button"
                disabled={isLoading}
                onClick={handleLocalDemoSignIn}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 py-3 px-4 text-sm font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50"
              >
                <span>Continue with local demo account</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-center text-xs text-stone-600 justify-center pt-1">
            <Info className="h-3.5 w-3.5 text-stone-500" />
            <span>Secure sign-in with Google and role-based access to your private wellness dashboard.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
