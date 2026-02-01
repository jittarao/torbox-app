import express from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { sendSuccess } from './admin/helpers.js';
import { setupUserRoutes } from './admin/users.js';
import { setupMetricsRoutes } from './admin/metrics.js';
import { setupDatabaseRoutes } from './admin/databases.js';
import { setupAutomationRoutes } from './admin/automation.js';
import { setupConfigRoutes } from './admin/config.js';
import { setupDiagnosticsRoutes } from './admin/diagnostics.js';

/**
 * Admin API Routes
 * Provides admin endpoints for managing the entire application
 */
export function setupAdminRoutes(app, backend) {
  const router = express.Router();

  // Apply admin auth middleware to all routes (no rate limit for admin)
  router.use(adminAuthMiddleware);

  // ===== Admin Authentication =====

  router.post('/auth', (req, res) => {
    // Authentication is handled by middleware
    sendSuccess(res, {
      message: 'Admin authenticated',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/verify', (req, res) => {
    sendSuccess(res, {
      authenticated: true,
      timestamp: new Date().toISOString(),
    });
  });

  // ===== Setup Modular Route Handlers =====
  setupUserRoutes(router, backend);
  setupMetricsRoutes(router, backend);
  setupDatabaseRoutes(router, backend);
  setupAutomationRoutes(router, backend);
  setupConfigRoutes(router, backend);
  setupDiagnosticsRoutes(router, backend);

  // Mount admin routes
  app.use('/api/admin', router);
}
