// Get version from package.json
export function getVersion() {
  try {
    // In production, we'll use the version from the build
    if (typeof window !== 'undefined' && window.__NEXT_DATA__?.buildId) {
      // This will be set during build time
      return process.env.NEXT_PUBLIC_APP_VERSION || '0.1.24';
    }
    
    // Fallback to package.json version
    return '0.1.26';
  } catch (error) {
    console.warn('Could not get version:', error);
    return '0.1.26';
  }
}
