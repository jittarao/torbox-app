import { validateAuthIdMiddleware, validateNumericIdMiddleware } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import RuleRepository from '../automation/helpers/RuleRepository.js';
import AutomationEngine from '../automation/AutomationEngine.js';

/**
 * Create an automation engine for a single request (not cached).
 * Returns null if user has no active API key.
 */
async function getEngineForRequest(backend, authId) {
  const apiKeyRow = backend.masterDatabase.getApiKey(authId);
  if (!apiKeyRow?.encrypted_key) return null;
  const engine = new AutomationEngine(
    authId,
    apiKeyRow.encrypted_key,
    backend.userDatabaseManager,
    backend.masterDatabase
  );
  await engine.initialize();
  return engine;
}

/**
 * Send 403 or 404 when getEngineForRequest returned null (user exists but key inactive, or user not found).
 */
function sendEngineUnavailableResponse(res, backend, authId) {
  const reason = backend.masterDatabase.getApiKeyUnavailableReason(authId);
  if (reason === 'inactive') {
    return res.status(403).json({
      success: false,
      error: 'API key is inactive. Please re-add your API key in Settings to run automations.',
      code: 'API_KEY_INACTIVE',
    });
  }
  if (reason === 'missing') {
    return res.status(403).json({
      success: false,
      error: 'API key missing. Please add your API key in Settings.',
      code: 'API_KEY_MISSING',
    });
  }
  return res.status(404).json({ success: false, error: 'User not found' });
}

/**
 * Automation rules routes
 */
export function setupAutomationRoutes(app, backend) {
  const { userRateLimiter, pollingScheduler, eventNotifier } = backend;

  // GET /api/automation/events - SSE stream; notifies when this user's poll completes with changes (no rate limit for long-lived connection)
  if (eventNotifier) {
    app.get('/api/automation/events', validateAuthIdMiddleware, (req, res) => {
      const authId = req.validatedAuthId;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      eventNotifier.subscribe(authId, res);
      req.on('close', () => eventNotifier.unsubscribe(authId, res));
    });
  }

  // GET /api/automation/rules - Get all automation rules (direct DB, no engine)
  app.get('/api/automation/rules', validateAuthIdMiddleware, userRateLimiter, async (req, res) => {
    const authId = req.validatedAuthId;
    const userDatabaseManager = backend.userDatabaseManager;
    if (!userDatabaseManager) {
      logger.error('User database manager not initialized', {
        endpoint: '/api/automation/rules',
        authId,
      });
      return res.status(503).json({
        success: false,
        error: 'Service initializing',
      });
    }
    let userDbConnection;
    try {
      userDbConnection = await userDatabaseManager.getUserDatabase(authId);
      if (!userDbConnection?.db) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const repo = new RuleRepository(authId, () => Promise.resolve(userDbConnection.db));
      const rules = await repo.getRules();
      res.json({ success: true, rules });
    } catch (error) {
      logger.error('Error fetching automation rules', error, {
        endpoint: '/api/automation/rules',
        method: 'GET',
        authId,
      });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (authId && userDatabaseManager) {
        userDatabaseManager.releaseConnection(authId);
      }
    }
  });

  // POST /api/automation/rules - Save automation rules (engine on demand)
  app.post('/api/automation/rules', validateAuthIdMiddleware, userRateLimiter, async (req, res) => {
    const authId = req.validatedAuthId;
    try {
      const engine = await getEngineForRequest(backend, authId);
      if (!engine) {
        return sendEngineUnavailableResponse(res, backend, authId);
      }
      const { rules } = req.body;
      const savedRules = await engine.saveAutomationRules(rules);
      await engine.reloadRules();
      if (pollingScheduler) {
        await pollingScheduler.refreshPollers();
      }
      res.json({ success: true, message: 'Rules saved successfully', rules: savedRules });
    } catch (error) {
      logger.error('Error saving automation rules', error, {
        endpoint: '/api/automation/rules',
        method: 'POST',
        authId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/automation/rules/:id - Update rule status (engine on demand)
  app.put(
    '/api/automation/rules/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      const authId = req.validatedAuthId;
      const ruleId = req.validatedIds.id;
      try {
        const engine = await getEngineForRequest(backend, authId);
        if (!engine) {
          return sendEngineUnavailableResponse(res, backend, authId);
        }
        const { enabled } = req.body;
        await engine.updateRuleStatus(ruleId, enabled);
        if (pollingScheduler) {
          await pollingScheduler.refreshPollers();
        }
        res.json({ success: true, message: 'Rule updated successfully' });
      } catch (error) {
        logger.error('Error updating rule', error, {
          endpoint: `/api/automation/rules/${req.params.id}`,
          method: 'PUT',
          ruleId,
          authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/automation/rules/:id - Delete rule (engine on demand)
  app.delete(
    '/api/automation/rules/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      const authId = req.validatedAuthId;
      const ruleId = req.validatedIds.id;
      try {
        const engine = await getEngineForRequest(backend, authId);
        if (!engine) {
          return sendEngineUnavailableResponse(res, backend, authId);
        }
        await engine.deleteRule(ruleId);
        if (pollingScheduler) {
          await pollingScheduler.refreshPollers();
        }
        res.json({ success: true, message: 'Rule deleted successfully' });
      } catch (error) {
        logger.error('Error deleting rule', error, {
          endpoint: `/api/automation/rules/${req.params.id}`,
          method: 'DELETE',
          ruleId,
          authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // GET /api/automation/rules/:id/logs - Get rule execution history (engine on demand)
  app.get(
    '/api/automation/rules/:id/logs',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      const authId = req.validatedAuthId;
      const ruleId = req.validatedIds.id;
      try {
        const engine = await getEngineForRequest(backend, authId);
        if (!engine) {
          return sendEngineUnavailableResponse(res, backend, authId);
        }
        const logs = await engine.getRuleExecutionHistory(ruleId);
        res.json({ success: true, logs });
      } catch (error) {
        logger.error('Error fetching rule logs', error, {
          endpoint: `/api/automation/rules/${req.params.id}/logs`,
          method: 'GET',
          ruleId,
          authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/automation/rules/:id/logs - Clear rule execution history (engine on demand)
  app.delete(
    '/api/automation/rules/:id/logs',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      const authId = req.validatedAuthId;
      const ruleId = req.validatedIds.id;
      try {
        const engine = await getEngineForRequest(backend, authId);
        if (!engine) {
          return sendEngineUnavailableResponse(res, backend, authId);
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
          ruleId,
          authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/automation/rules/:id/run - Manually execute a rule (engine on demand)
  app.post(
    '/api/automation/rules/:id/run',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      const authId = req.validatedAuthId;
      const ruleId = req.validatedIds.id;
      try {
        const engine = await getEngineForRequest(backend, authId);
        if (!engine) {
          return sendEngineUnavailableResponse(res, backend, authId);
        }
        const runRule = () => engine.runRuleManually(ruleId);
        const result = backend.pollingScheduler
          ? await backend.pollingScheduler.runWithPipelineLock(authId, runRule)
          : await runRule();
        res.json({ success: true, result });
      } catch (error) {
        logger.error('Error running rule manually', error, {
          endpoint: `/api/automation/rules/${req.params.id}/run`,
          method: 'POST',
          ruleId,
          authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
