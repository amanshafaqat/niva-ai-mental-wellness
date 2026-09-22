import React from 'react';
import {
  ShieldCheck,
  HeartHandshake,
  Users,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';

interface HeroSectionProps {
  onOpenAuthModal: () => void;
  onGoToDashboard: () => void;
  onGoToArchitecture: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenAuthModal,
  onGoToDashboard,
  onGoToArchitecture,
}) => {
  const { isAuthenticated, session } = useAuth();

  return (
    <section id="hero-section" className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Core Hero Branding */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-900 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
            <span>NIVA Foundation • Phase 1 Architecture</span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl md:text-6xl">
            Someone to talk to.
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto">
            NIVA is a privacy-conscious AI mental wellness companion designed for students,
            adults, and senior citizens—offering a calm, empathetic ear whenever you need one.
          </p>

          <p className="mt-2 text-xs sm:text-sm text-stone-500 italic">
            Built with strict client-consent guardrails, zero data monetization, and clear non-clinical boundaries.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            {isAuthenticated ? (
              <button
                id="hero-enter-dashboard-button"
                onClick={onGoToDashboard}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <span>Enter Your Protected Wellness Area</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                id="hero-signin-google-button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <Lock className="h-4 w-4" />
                <span>Continue with Google</span>
              </button>
            )}

            <button
              id="hero-view-architecture-button"
              onClick={onGoToArchitecture}
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-base font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 hover:text-stone-900"
            >
              <FileCode2 className="h-4 w-4 text-stone-500" />
              <span>Explore Phase 1 Architecture</span>
            </button>
          </div>
        </div>

        {/* Value Pillars Grid (Non-slop, clean architectural highlights) */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Pillar 1 */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900">Privacy & Consent by Design</h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Strictly non-commercial data handling. Conversations are never sold, and even
              administrators cannot browse user dialogues without governed cryptographic consent.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Prisma & PostgreSQL audit trail</span>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900">Role-Based Governance (RBAC)</h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Structured around three clearly isolated roles: <strong>USER</strong>,{' '}
              <strong>GUARDIAN</strong>, and <strong>ADMIN</strong>. Server-side NestJS guards
              prevent unauthorized privilege escalation.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Default role: USER on Google OAuth</span>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 mb-4">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900">Decoupled AI Engine Abstraction</h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Vendor-agnostic AI provider architecture. Decoupled interfaces ready for Phase 2 text
              dialogue and Phase 3 realtime voice sessions without rewriting backend core services.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-blue-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Extensible AIProvider interface</span>
            </div>
          </div>
        </div>

        {/* Non-Clinical Ethical Commitment Box */}
        <div className="mt-12 rounded-2xl border border-stone-200 bg-stone-50/70 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <h3 className="text-base font-semibold text-stone-900">
                Ethical Mental Wellness & Safety Philosophy
              </h3>
              <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">
                NIVA is engineered as a supportive, compassionate listener. It is fundamentally
                prohibited from prescribing clinical diagnoses, advising on medications, or
                facilitating dangerous conduct. A dedicated multi-stage safety detector will monitor
                and direct users to verified human crisis lifelines.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              <div className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-center">
                <div className="text-xs text-stone-500 font-medium">Crisis Protocol</div>
                <div className="text-lg font-bold text-emerald-800">Lifeline 988</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
