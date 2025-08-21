// Performance monitoring utilities
export const performance = {
  // Track component render times
  trackRender: (componentName) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const start = performance.now();
      return () => {
        const end = performance.now();
        console.log(`${componentName} render time: ${(end - start).toFixed(2)}ms`);
      };
    }
    return () => {};
  },

  // Track API call performance
  trackApiCall: (endpoint) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const start = performance.now();
      return () => {
        const end = performance.now();
        console.log(`${endpoint} API call time: ${(end - start).toFixed(2)}ms`);
      };
    }
    return () => {};
  },

  // Track bundle size
  getBundleSize: () => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const scripts = document.querySelectorAll('script[src]');
      let totalSize = 0;
      
      scripts.forEach(script => {
        const src = script.src;
        if (src.includes('_next/static/chunks/')) {
          // This is a rough estimate - in production you'd want more accurate measurement
          console.log(`Script loaded: ${src}`);
        }
      });
    }
  },
};

// Memory usage tracking
export const memoryUsage = {
  track: () => {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = performance.memory;
      console.log(`Memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB / ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    }
  },
};

// Build optimization helpers
export const buildOptimizations = {
  // Lazy load components
  lazyLoad: (importFn, fallback = null) => {
    return dynamic(importFn, {
      loading: fallback || (() => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-full rounded"></div>),
      ssr: false,
    });
  },

  // Preload critical resources
  preloadCritical: () => {
    if (typeof window !== 'undefined') {
      // Preload critical CSS and fonts
      const criticalResources = [
        '/fonts/inter-var.woff2',
        '/images/TBM-logo.png',
      ];

      criticalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = resource.endsWith('.woff2') ? 'font' : 'image';
        document.head.appendChild(link);
      });
    }
  },
};
