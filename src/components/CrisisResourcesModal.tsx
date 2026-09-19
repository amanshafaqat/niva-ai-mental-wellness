import React, { useState, useEffect } from 'react';
import { X, Phone, MessageSquare, Globe, ShieldAlert, HeartHandshake, AlertCircle, ExternalLink } from 'lucide-react';
import { CrisisResource, CrisisResourceType } from '../../shared/types/safety';
import {
  getCrisisResourcesForCountry,
  SUPPORTED_COUNTRIES,
  getSafeUnknownLocationGuidance,
} from '../services/safety/crisis-registry';

interface CrisisResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCountryCode?: string;
}

export const CrisisResourcesModal: React.FC<CrisisResourcesModalProps> = ({
  isOpen,
  onClose,
  initialCountryCode = 'GLOBAL',
}) => {
  const [selectedCountry, setSelectedCountry] = useState<string>(initialCountryCode);
  const [resources, setResources] = useState<CrisisResource[]>([]);

  useEffect(() => {
    setResources(getCrisisResourcesForCountry(selectedCountry));
  }, [selectedCountry]);

  if (!isOpen) return null;

  const emergencyServices = resources.filter((r) => r.type === 'EMERGENCY');
  const supportHelplines = resources.filter((r) => r.type === 'CRISIS_HELPLINE' || r.type === 'TEXT_LINE');
  const specializedServices = resources.filter((r) => r.type === 'SPECIALIZED');
  const globalDirectories = resources.filter((r) => r.type === 'GLOBAL_DIRECTORY');
  const unknownGuidance = getSafeUnknownLocationGuidance();

  return (
    <div
      id="crisis-resources-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rose-100 bg-rose-50/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h2 id="crisis-modal-title" className="text-lg font-semibold text-slate-900">
                Verified Crisis & Support Resources
              </h2>
              <p className="text-xs text-slate-600">
                Free, confidential, verified support available 24/7 worldwide
              </p>
            </div>
          </div>
          <button
            id="close-crisis-modal-btn"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-100 hover:text-slate-700 transition"
            aria-label="Close crisis resources dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Important Boundary Notice */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-900">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-medium text-rose-950">Immediate Safety First</p>
                <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                  NIVA is an AI wellness companion, not an emergency service, hospital, or crisis hotline.
                  If you or someone you are with is in immediate physical danger, please contact your local
                  emergency dispatch or step to a safe place with someone you trust right now.
                </p>
              </div>
            </div>
          </div>

          {/* Country / Region Selector */}
          <div>
            <label htmlFor="country-selector" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Your Country or Region
            </label>
            <select
              id="country-selector"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} {c.code !== 'GLOBAL' ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Immediate Emergency Services (Police / Ambulance) */}
          {emergencyServices.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Immediate Emergency Dispatch
              </h3>
              {emergencyServices.map((r) => (
                <div key={r.id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{r.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{r.description}</p>
                    <span className="inline-block mt-1 text-[11px] font-medium text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      {r.hoursOfOperation} • {r.languages.join(', ')}
                    </span>
                  </div>
                  {r.contactNumber && (
                    <a
                      href={`tel:${r.contactNumber.replace(/[^0-9+]/g, '')}`}
                      className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-bold text-white shadow hover:bg-rose-700 transition"
                    >
                      <Phone className="h-4 w-4" />
                      {r.contactNumber}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Emotional Support Helplines & Text Lines */}
          {supportHelplines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4 text-emerald-600" /> Free & Confidential Crisis Helplines
              </h3>
              <div className="grid gap-2">
                {supportHelplines.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-slate-900">{r.name}</h4>
                        <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{r.description}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Hours: {r.hoursOfOperation} • Languages: {r.languages.join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {r.contactNumber && (
                        <a
                          href={`tel:${r.contactNumber.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-100 transition"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-600" />
                          {r.contactNumber}
                        </a>
                      )}
                      {r.smsNumber && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                          {r.smsNumber}
                        </span>
                      )}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specialized Services (Youth, LGBTQ+, Domestic Violence) */}
          {specializedServices.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Specialized Support Services
              </h3>
              <div className="grid gap-2">
                {specializedServices.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{r.name}</h4>
                      <p className="text-xs text-slate-600 mt-1">{r.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.contactNumber && (
                        <a
                          href={`tel:${r.contactNumber.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                        >
                          <Phone className="h-3.5 w-3.5 text-purple-600" />
                          {r.contactNumber}
                        </a>
                      )}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worldwide & International Directories (Always Accessible) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-blue-600" /> International Helplines & Directories (130+ Countries)
            </h3>
            <div className="grid gap-2">
              {globalDirectories.map((r) => (
                <div key={r.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{r.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{r.description}</p>
                    <span className="inline-block mt-1 text-[11px] text-blue-800 font-medium">
                      {r.countryName} • {r.languages.join(', ')}
                    </span>
                  </div>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Visit Site
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>All crisis listings are free and verified.</span>
          <button
            id="close-crisis-modal-bottom-btn"
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
