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
import { ArchitectureViewer } from './components/ArchitectureViewer';
import { SystemHealthWidget } from './components/SystemHealthWidget';
import { GoogleSignInModal } from './components/GoogleSignInModal';
import { DownloadZipModal } from './components/DownloadZipModal';
import { CrisisResourcesModal } from './components/CrisisResourcesModal';
import { Sparkles, Shield, HeartHandshake } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<'home' | 'dashboard' | 'architecture' | 'health'>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [zipModalOpen, setZipModalOpen] = useState(false);
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
          onOpenZipModal={() => setZipModalOpen(true)}
          onOpenCrisisResources={handleOpenCrisisResources}
        />

        {/* Main View Router */}
        <main className="flex-1">
          {activeView === 'home' && (
            <div>
              <HeroSection
                onOpenAuthModal={() => setAuthModalOpen(true)}
                onGoToDashboard={() => setActiveView('dashboard')}
                onGoToArchitecture={() => setActiveView('architecture')}
              />
              <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
                <SystemHealthWidget />
              </div>
            </div>
          )}

          {activeView === 'dashboard' && (
            <DashboardView onOpenCrisisResources={handleOpenCrisisResources} />
          )}

          {activeView === 'architecture' && (
            <div className="py-8 mx-auto max-w-6xl px-4 sm:px-6">
              <ArchitectureViewer />
            </div>
          )}

          {activeView === 'health' && (
            <div className="py-8 mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
              <SystemHealthWidget />
              <ArchitectureViewer />
            </div>
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
              <span>— Someone to talk to. (Phase 5 Advanced Safety & Crisis Engine)</span>
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
                Zero-Knowledge Privacy Architecture
              </span>
              <button
                onClick={() => setZipModalOpen(true)}
                className="underline hover:text-stone-900 transition"
              >
                Download Phase 5 ZIP
              </button>
            </div>
          </div>
        </footer>

        {/* Modals */}
        <GoogleSignInModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => setActiveView('dashboard')}
        />

        <DownloadZipModal
          isOpen={zipModalOpen}
          onClose={() => setZipModalOpen(false)}
        />

        <CrisisResourcesModal
          isOpen={crisisModalOpen}
          onClose={handleCloseCrisisResources}
        />
      </div>
    </AuthProvider>
  );
}
