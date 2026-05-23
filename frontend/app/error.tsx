'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-5 border border-red-100">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
