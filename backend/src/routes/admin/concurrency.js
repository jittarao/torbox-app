import Semaphore from '../../utils/semaphore.js';
import { getUserDatabaseSafe } from './helpers.js';

/** Bounded parallelism when opening many user SQLite DBs from admin routes */
const DEFAULT_ADMIN_USER_DB_CONCURRENCY = 8;

/**
 * Process-wide cap on concurrent user DB opens from admin multi-user scans.
 * Prevents parallel admin pages (e.g. automation overview) from multiplying pool usage.
 */
const adminUserDbGlobalSemaphore = new Semaphore(
  parseInt(process.env.ADMIN_USER_DB_GLOBAL_CONCURRENCY || '8', 10)
);

/**
 * Run async work for each user row, with at most `concurrency` user DBs open at once.
 * Closes each connection when done (same as startup sync) so admin scans do not fill the LRU pool.
 *
 * @param {object} backend
 * @param {Array<{ auth_id: string, key_name?: string }>} users
 * @param {(userDb: object, user: object) => Promise<unknown>} workFn
 * @param {number} [concurrency]
 * @returns {Promise<unknown[]>} One result per user (null skips from workFn returning null)
 */
export async function mapUserDatabaseWork(
  backend,
  users,
  workFn,
  concurrency = DEFAULT_ADMIN_USER_DB_CONCURRENCY
) {
  const sem = new Semaphore(concurrency);
  return Promise.all(
    users.map((user) =>
      (async () => {
        await adminUserDbGlobalSemaphore.acquire();
        await sem.acquire();
        try {
          const userDb = await getUserDatabaseSafe(backend, user.auth_id);
          if (!userDb) {
            return null;
          }
          try {
            return await workFn(userDb, user);
          } finally {
            backend.userDatabaseManager.closeConnection(user.auth_id);
          }
        } finally {
          sem.release();
          adminUserDbGlobalSemaphore.release();
        }
      })()
    )
  );
}

/**
 * Bounded parallelism for arbitrary async work (e.g. filesystem stats per path).
 *
 * @template T, R
 * @param {T[]} items
 * @param {(item: T) => Promise<R>} fn
 * @param {number} [concurrency]
 * @returns {Promise<R[]>}
 */
export async function runWithConcurrency(items, fn, concurrency = 16) {
  const sem = new Semaphore(concurrency);
  return Promise.all(
    items.map((item) =>
      (async () => {
        await sem.acquire();
        try {
          return await fn(item);
        } finally {
          sem.release();
        }
      })()
    )
  );
}
