'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f3f3f3',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#18181b', marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '1.5rem', maxWidth: '28rem' }}>
            {error.message || 'A critical error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#18181b',
              color: '#fff',
              border: 'none',
              padding: '0.625rem 1.25rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
