import { validateAuthIdMiddleware, validateNumericIdMiddleware } from '../middleware/validation.js';
import logger from '../utils/logger.js';

/**
 * Automation rules routes
 */
export function setupAutomationRoutes(app, backend) {
  const { userRateLimiter, automationEngines, pollingScheduler } = backend;

  // GET /api/automation/rules - Get all automation rules
  app.get('/api/automation/rules', validateAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      const engine = automationEngines.get(authId);
      if (!engine) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const rules = await engine.getAutomationRules();
      res.json({ success: true, rules });
    } catch (error) {
      logger.error('Error fetching automation rules', error, {
        endpoint: '/api/automation/rules',
        method: 'GET',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/automation/rules - Save automation rules
  app.post('/api/automation/rules', validateAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      const { rules } = req.body;
      const engine = automationEngines.get(authId);
      if (!engine) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Save rules and get back the saved rules with database-assigned IDs
      const savedRules = await engine.saveAutomationRules(rules);
      await engine.reloadRules();

      // Refresh pollers to ensure poller exists for this user
      if (pollingScheduler) {
        await pollingScheduler.refreshPollers();
      }

      res.json({ success: true, message: 'Rules saved successfully', rules: savedRules });
    } catch (error) {
      logger.error('Error saving automation rules', error, {
        endpoint: '/api/automation/rules',
        method: 'POST',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/automation/rules/:id - Update rule status
  app.put(
    '/api/automation/rules/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const ruleId = req.validatedIds.id;
        const { enabled } = req.body;
        const engine = automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await engine.updateRuleStatus(ruleId, enabled);

        // Refresh pollers to ensure poller exists for this user
        if (pollingScheduler) {
          await pollingScheduler.refreshPollers();
        }

        res.json({ success: true, message: 'Rule updated successfully' });
      } catch (error) {
        logger.error('Error updating rule', error, {
          endpoint: `/api/automation/rules/${req.params.id}`,
          method: 'PUT',
          ruleId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/automation/rules/:id - Delete rule
  app.delete(
    '/api/automation/rules/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const ruleId = req.validatedIds.id;
        const engine = automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await engine.deleteRule(ruleId);

        // Refresh pollers to ensure poller exists for this user
        if (pollingScheduler) {
          await pollingScheduler.refreshPollers();
        }

        res.json({ success: true, message: 'Rule deleted successfully' });
      } catch (error) {
        logger.error('Error deleting rule', error, {
          endpoint: `/api/automation/rules/${req.params.id}`,
          method: 'DELETE',
          ruleId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // GET /api/automation/rules/:id/logs - Get rule execution history
  app.get(
    '/api/automation/rules/:id/logs',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const ruleId = req.validatedIds.id;
        const engine = automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const logs = await engine.getRuleExecutionHistory(ruleId);
        res.json({ success: true, logs });
      } catch (error) {
        logger.error('Error fetching rule logs', error, {
          endpoint: `/api/automation/rules/${req.params.id}/logs`,
          method: 'GET',
          ruleId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/automation/rules/:id/logs - Clear rule execution history
  app.delete(
    '/api/automation/rules/:id/logs',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const ruleId = req.validatedIds.id;
        const engine = automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await engine.clearRuleExecutionHistory(ruleId);
        res.json({
          success: true,
          message: 'Rule logs cleared successfully',
        });
      } catch (error) {
        logger.error('Error clearing rule logs', error, {
          endpoint: `/api/automation/rules/${req.params.id}/logs`,
          method: 'DELETE',
          ruleId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/automation/rules/:id/run - Manually execute a rule
  app.post(
    '/api/automation/rules/:id/run',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const ruleId = req.validatedIds.id;
        const engine = automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const result = await engine.runRuleManually(ruleId);
        res.json({ success: true, result });
      } catch (error) {
        logger.error('Error running rule manually', error, {
          endpoint: `/api/automation/rules/${req.params.id}/run`,
          method: 'POST',
          ruleId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
