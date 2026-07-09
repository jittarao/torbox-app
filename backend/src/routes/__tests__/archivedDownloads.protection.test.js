import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
} from './helpers/backendTestHelper.js';
import { setupArchivedDownloadsRoutes } from '../archivedDownloads.js';
import { setupProtectedDownloadsRoutes } from '../protectedDownloads.js';

describe('archived downloads protection', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    app = buildBackendApp({
      ...env,
      routeSetupFn: (expressApp, backend) => {
        setupProtectedDownloadsRoutes(expressApp, backend);
        setupArchivedDownloadsRoutes(expressApp, backend);
      },
    });
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  async function protect(downloadIds) {
    await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: downloadIds, protected: true });
  }

  test('single archive returns 403 for protected download', async () => {
    await protect(['99']);

    const res = await request(app)
      .post('/api/archived-downloads')
      .set('x-api-key', env.apiKey)
      .send({ torrent_id: '99', hash: 'abc', name: 'Protected Torrent' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DOWNLOAD_PROTECTED');
    expect(res.body.blocked_ids).toEqual(['99']);
  });

  test('bulk archive filters protected downloads and returns blocked_ids', async () => {
    await protect(['1']);

    const res = await request(app)
      .post('/api/archived-downloads/bulk')
      .set('x-api-key', env.apiKey)
      .send({
        downloads: [
          { torrent_id: '1', hash: 'aaa', name: 'Protected' },
          { torrent_id: '2', hash: 'bbb', name: 'Allowed' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.torrentIds).toEqual(['2']);
    expect(res.body.data.blocked_ids).toEqual(['1']);
  });

  test('bulk archive returns 403 when all downloads are protected', async () => {
    await protect(['1', '2']);

    const res = await request(app)
      .post('/api/archived-downloads/bulk')
      .set('x-api-key', env.apiKey)
      .send({
        downloads: [
          { torrent_id: '1', hash: 'aaa' },
          { torrent_id: '2', hash: 'bbb' },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DOWNLOAD_PROTECTED');
    expect(res.body.blocked_ids.sort()).toEqual(['1', '2']);
  });
});
