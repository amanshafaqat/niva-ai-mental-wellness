import React from 'react';
import { AlertTriangle, PhoneCall, ShieldCheck } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <div
      id="crisis-disclaimer-banner"
      role="region"
      aria-label="Important Mental Health Notice"
      className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2.5 text-xs text-amber-950 sm:text-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span className="font-medium">
            <strong>Important:</strong> NIVA is a supportive AI companion, not a licensed medical professional or replacement for clinical care.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-amber-900">
            <PhoneCall className="h-3.5 w-3.5 text-amber-800" aria-hidden="true" />
            Immediate Crisis? Dial or text{' '}
            <a
              href="tel:988"
              className="underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
            >
              988
            </a>{' '}
            (US/CA) or your local helpline.
          </span>
        </div>
      </div>
    </div>
  );
};
