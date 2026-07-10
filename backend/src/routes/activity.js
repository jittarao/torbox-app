import logger from '../utils/logger.js';
import { serverErrorPayload } from '../utils/httpErrors.js';

/**
 * User activity beacon route (frontend POSTs periodically).
 */
export function setupActivityRoutes(app, backend) {
  const { userRateLimiter } = backend;

  app.post('/api/activity', backend.requireRegisteredUser, userRateLimiter, (req, res) => {
    try {
      const authId = req.validatedAuthId;
      if (backend.activityTracker) {
        backend.activityTracker.touch(authId);
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Error recording user activity', error, {
        endpoint: '/api/activity',
        authId: req.validatedAuthId,
      });
      res.status(500).json(serverErrorPayload(error));
    }
  });
}
