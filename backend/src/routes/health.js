import { HealthCheckService } from '../services/healthCheck.js';

/**
 * Health check routes
 */
export function setupHealthRoutes(app, backend) {
  const healthCheckService = new HealthCheckService(
    backend.masterDatabase,
    backend.automationEngines,
    backend.pollingScheduler
  );

  // Health check
  app.get('/api/backend/status', (req, res) => {
    const schedulerStatus = backend.pollingScheduler
      ? backend.pollingScheduler.getStatus()
      : null;
    res.json({
      available: true,
      mode: 'selfhosted',
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      pollingScheduler: schedulerStatus,
      automationEngines: backend.automationEngines?.size ?? 0,
      connectionPool: backend.userDatabaseManager?.getPoolStats() ?? null,
    });
  });

  // Health check for Docker
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Detailed health check endpoint
  app.get('/api/health/detailed', async (req, res) => {
    try {
      const health = await healthCheckService.getDetailedHealth(backend.userDatabaseManager);
      const statusCode = health.status === 'unhealthy' ? 500 : 200;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });
}
