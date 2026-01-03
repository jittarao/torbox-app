import * as Sentry from '@sentry/nextjs';

let dbInitialized = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
    
    // Only import and initialize database in Node.js runtime
    // Use dynamic import with string concatenation to prevent static analysis
    // This ensures Next.js doesn't analyze database files for Edge runtime
    try {
      // Construct import paths dynamically to prevent static analysis
      const dbPath = './database/' + 'db';
      const configPath = './utils/' + 'backendConfig';
      
      const dbModule = await import(dbPath);
      const configModule = await import(configPath);
      
      const { initializeDatabase } = dbModule;
      const { isMultiUserBackendEnabled } = configModule;
      
      // Initialize database on server startup only if backend is enabled
      if (!dbInitialized && isMultiUserBackendEnabled()) {
        try {
          await initializeDatabase();
          dbInitialized = true;
          console.log('Database initialized in Next.js');
        } catch (error) {
          console.error('Failed to initialize database:', error);
          // Don't throw - allow app to start even if DB init fails
          // (useful for development when DB might not be available)
        }
      } else if (!isMultiUserBackendEnabled()) {
        console.log('Multi-user backend is disabled. Database features will not be available.');
      }
    } catch (error) {
      // If imports fail (e.g., in Edge runtime), just log and continue
      // This is expected in Edge runtime, so we don't log as error
      if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.error('Failed to load database modules:', error);
      }
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
