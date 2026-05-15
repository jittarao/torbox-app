import express from 'express';
import { describe, it, expect } from 'bun:test';
import request from 'supertest';
import { setupHealthRoutes } from '../routes/health.js';

describe('HTTP smoke', () => {
  it('GET /health returns JSON healthy', async () => {
    const app = express();
    const mockBackend = {
      masterDatabase: null,
      automationEngines: new Map(),
      pollingScheduler: null,
      userDatabaseManager: null,
    };
    setupHealthRoutes(app, mockBackend);

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
