'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '16px',
            padding: '32px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
            A critical error occurred
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#666',
              maxWidth: '400px',
              textAlign: 'center',
              margin: 0,
            }}
          >
            {error?.message || 'The application encountered an unrecoverable error'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '8px 16px',
              background: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
