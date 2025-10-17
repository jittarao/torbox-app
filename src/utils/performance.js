// Simple performance monitoring

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  startTimer(label) {
    this.metrics.set(label, {
      startTime: performance.now(),
      endTime: null,
      duration: null
    });
  }

  endTimer(label) {
    const metric = this.metrics.get(label);
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      
      // Log slow requests (>3 seconds)
      if (metric.duration > 3000) {
        console.warn(`Slow API call: ${label} took ${metric.duration.toFixed(2)}ms`);
      }
      
      return metric.duration;
    }
    return null;
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();