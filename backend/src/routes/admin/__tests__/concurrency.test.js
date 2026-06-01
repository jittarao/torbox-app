import { describe, expect, test, mock } from 'bun:test';
import { mapUserDatabaseWork } from '../concurrency.js';

describe('mapUserDatabaseWork', () => {
  test('closes each user DB after work (does not retain in LRU pool)', async () => {
    const closed = [];
    const backend = {
      userDatabaseManager: {
        async getUserDatabase(authId) {
          return { db: {}, authId };
        },
        closeConnection(authId) {
          closed.push(authId);
        },
        releaseConnection() {
          throw new Error('releaseConnection should not be used for admin scans');
        },
      },
    };

    const users = [{ auth_id: 'a'.repeat(64) }, { auth_id: 'b'.repeat(64) }];
    const workFn = mock(async (userDb) => `ok-${userDb.authId}`);

    const results = await mapUserDatabaseWork(backend, users, workFn, 2);

    expect(results).toEqual([`ok-${'a'.repeat(64)}`, `ok-${'b'.repeat(64)}`]);
    expect(closed).toEqual(users.map((u) => u.auth_id));
    expect(workFn).toHaveBeenCalledTimes(2);
  });
});
