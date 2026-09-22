/**
 * NIVA Mental Wellness Companion - Phase 5 Advanced Safety & Crisis Response
 * Root Application Component
 */

import React, { useState } from 'react';
import { AuthProvider } from './lib/auth-context';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { DashboardView } from './components/DashboardView';
import { GoogleSignInModal } from './components/GoogleSignInModal';
import { CrisisResourcesModal } from './components/CrisisResourcesModal';
import { Sparkles, Shield, HeartHandshake } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<'home' | 'dashboard'>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [crisisModalOpen, setCrisisModalOpen] = useState(false);

  const handleOpenCrisisResources = () => setCrisisModalOpen(true);
  const handleCloseCrisisResources = () => setCrisisModalOpen(false);

  return (
    <AuthProvider>
      <div id="niva-root-application" className="min-h-screen bg-[#FBFDFB] text-stone-800 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
        {/* Ethical Non-Clinical Disclaimer Banner with Crisis Access */}
        <DisclaimerBanner onOpenCrisisResources={handleOpenCrisisResources} />

        {/* Global Navigation with Crisis Direct Button */}
        <Navbar
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onOpenCrisisResources={handleOpenCrisisResources}
        />

        {/* Main View Router */}
        <main className="flex-1">
          {activeView === 'home' && (
            <HeroSection
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onGoToDashboard={() => setActiveView('dashboard')}
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView onOpenCrisisResources={handleOpenCrisisResources} />
          )}
        </main>

        {/* Calm, Accessible Footer with Crisis Directory Access */}
        <footer id="niva-footer" className="border-t border-stone-200 bg-white py-8 text-xs text-stone-600">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-700 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-stone-900">NIVA</span>
              <span>— Someone to talk to.</span>
            </div>

            <div className="flex items-center gap-6">
              <button
                id="footer-crisis-link"
                onClick={handleOpenCrisisResources}
                className="flex items-center gap-1.5 font-semibold text-rose-700 hover:text-rose-900 transition"
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                Verified Crisis Resources
              </button>
              <span className="flex items-center gap-1 text-stone-500">
                <Shield className="h-3.5 w-3.5 text-emerald-800" />
                Founded & Created by Aman Shafaqat
              </span>
            </div>
          </div>
        </footer>

        {/* Modals */}
        <GoogleSignInModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => setActiveView('dashboard')}
        />

        <CrisisResourcesModal
          isOpen={crisisModalOpen}
          onClose={handleCloseCrisisResources}
        />
      </div>
    </AuthProvider>
  );
}
