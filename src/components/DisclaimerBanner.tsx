import React from 'react';
import { AlertTriangle, PhoneCall, HeartHandshake } from 'lucide-react';

interface DisclaimerBannerProps {
  onOpenCrisisResources?: () => void;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ onOpenCrisisResources }) => {
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
            Immediate Crisis? Contact your local emergency services, or
          </span>
          {onOpenCrisisResources ? (
            <button
              id="banner-open-crisis-btn"
              onClick={onOpenCrisisResources}
              className="inline-flex items-center gap-1 font-semibold text-rose-700 underline hover:text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500 rounded px-1"
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              View Crisis Helplines
            </button>
          ) : (
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded font-semibold text-amber-900"
            >
              findahelpline.com
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

