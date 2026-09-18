import React from 'react';
import { Shield, Sparkles, Download, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { Role } from '@shared/constants/roles';

interface NavbarProps {
  onOpenAuthModal: () => void;
  onOpenZipModal: () => void;
  activeView: 'home' | 'dashboard' | 'architecture' | 'health';
  setActiveView: (view: 'home' | 'dashboard' | 'architecture' | 'health') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuthModal,
  onOpenZipModal,
  activeView,
  setActiveView,
}) => {
  const { session, isAuthenticated, signOut } = useAuth();

  const getRoleBadgeStyle = (role?: Role) => {
    switch (role) {
      case Role.ADMIN:
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case Role.GUARDIAN:
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case Role.USER:
      default:
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    }
  };

  return (
    <header
      id="main-navigation"
      className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md transition-colors"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            id="nav-logo-button"
            onClick={() => setActiveView('home')}
            className="group flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-emerald-600 rounded-lg p-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-semibold tracking-tight text-stone-900">NIVA</span>
              <span className="hidden text-xs text-stone-700 sm:block">Someone to talk to.</span>
            </div>
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              id="nav-tab-overview"
              onClick={() => setActiveView('home')}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'home'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-50'
              }`}
            >
              Overview
            </button>
            <button
              id="nav-tab-dashboard"
              onClick={() => setActiveView('dashboard')}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-50'
              }`}
            >
              {isAuthenticated ? 'My Wellness Area' : 'User Area'}
            </button>
            <button
              id="nav-tab-architecture"
              onClick={() => setActiveView('architecture')}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'architecture'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-50'
              }`}
            >
              Architecture & Specs
            </button>
            <button
              id="nav-tab-health"
              onClick={() => setActiveView('health')}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                activeView === 'health'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-50'
              }`}
            >
              System Health
            </button>
          </nav>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Download Project ZIP */}
          <button
            id="nav-download-zip-button"
            onClick={onOpenZipModal}
            aria-label="Download Project Zip"
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-100 hover:text-stone-900"
          >
            <Download className="h-3.5 w-3.5 text-emerald-800" />
            <span className="hidden sm:inline">Download Phase 2 ZIP</span>
            <span className="sm:hidden">ZIP</span>
          </button>

          {/* User Auth Section */}
          {isAuthenticated && session ? (
            <div className="flex items-center gap-2">
              <button
                id="user-profile-badge-btn"
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-1 text-left hover:bg-stone-100 transition"
              >
                {session.user.avatarUrl ? (
                  <img
                    src={session.user.avatarUrl}
                    alt={session.user.name || 'User avatar'}
                    className="h-6 w-6 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    {session.user.name?.[0] || 'U'}
                  </div>
                )}
                <span className="hidden lg:inline text-xs font-medium text-stone-800 max-w-[100px] truncate">
                  {session.user.name?.split(' ')[0]}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getRoleBadgeStyle(
                    session.user.role,
                  )}`}
                >
                  {session.user.role}
                </span>
              </button>

              <button
                id="logout-button"
                onClick={() => signOut()}
                title="Sign out of NIVA"
                className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus:outline-none"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              id="nav-signin-button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
