import React, { useState } from 'react';
import { X, Download, CheckCircle2, FileArchive, Package, ShieldCheck, Loader2 } from 'lucide-react';

interface DownloadZipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadZipModal: React.FC<DownloadZipModalProps> = ({ isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloading(true);
    // Direct trigger to download endpoint
    window.location.href = '/api/download-zip';
    setTimeout(() => {
      setDownloading(false);
    }, 2500);
  };

  return (
    <div
      id="download-zip-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <FileArchive className="h-5 w-5" />
            </div>
            <div>
              <h3 id="download-modal-title" className="text-xl font-semibold text-stone-900">
                Download NIVA Phase 1 Project
              </h3>
              <p className="text-xs text-stone-600">Complete, self-contained monorepo archive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50/70 p-4 text-xs text-stone-700 space-y-2">
          <div className="font-semibold text-stone-900 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-emerald-800" />
            <span>Archive Contents Verification:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>/backend (NestJS)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>/frontend (Next.js)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>/prisma (PostgreSQL)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>/shared (Types/Roles)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>Unit & RBAC Tests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>.env.example configs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>Complete README.md</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>AIProvider Interface</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-stone-600 bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
          <ShieldCheck className="h-4 w-4 text-emerald-800 shrink-0" />
          <span>
            Clean distribution: Excludes <code className="font-mono text-stone-800">node_modules</code>, build caches, and private keys.
          </span>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 transition"
          >
            Cancel
          </button>
          <button
            id="modal-confirm-download-btn"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Preparing Archive...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download niva-phase-1.zip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
