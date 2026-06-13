import { describe, it, expect, beforeEach } from 'bun:test';
import { createRequireRegisteredUser, requireInternalServiceAuth } from '../userAuth.js';
import { hashApiKey } from '../../utils/crypto.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('userAuth middleware', () => {
  const apiKey = 'test-api-key-12345678';
  const authId = hashApiKey(apiKey);

  let masterDb;
  let requireRegisteredUser;

  beforeEach(() => {
    masterDb = {
      initialized: true,
      getApiKey: (id) => (id === authId ? { encrypted_key: 'enc' } : null),
      getApiKeyUnavailableReason: () => null,
      getQuery: () => ({ status: 'active' }),
    };
    requireRegisteredUser = createRequireRegisteredUser(() => masterDb);
  });

  it('rejects requests without x-api-key or authId', () => {
    const req = { query: {}, headers: {}, body: {} };
    const res = mockRes();
    let nextCalled = false;
    requireRegisteredUser(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('accepts legacy authId when x-api-key is omitted', () => {
    const req = { query: { authId }, headers: {}, body: {} };
    const res = mockRes();
    let nextCalled = false;
    requireRegisteredUser(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.validatedAuthId).toBe(authId);
  });

  it('accepts valid x-api-key and sets validatedAuthId', () => {
    const req = {
      query: { authId },
      headers: { 'x-api-key': apiKey },
      body: {},
    };
    const res = mockRes();
    let nextCalled = false;
    requireRegisteredUser(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.validatedAuthId).toBe(authId);
  });

  it('rejects when authId does not match API key hash', () => {
    const req = {
      query: { authId: 'a'.repeat(64) },
      headers: { 'x-api-key': apiKey },
      body: {},
    };
    const res = mockRes();
    let nextCalled = false;
    requireRegisteredUser(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('rejects authId-only requests when BACKEND_REQUIRE_API_KEY is true', () => {
    const prev = process.env.BACKEND_REQUIRE_API_KEY;
    process.env.BACKEND_REQUIRE_API_KEY = 'true';
    try {
      const req = { query: { authId }, headers: {}, body: {} };
      const res = mockRes();
      let nextCalled = false;
      requireRegisteredUser(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.BACKEND_REQUIRE_API_KEY;
      else process.env.BACKEND_REQUIRE_API_KEY = prev;
    }
  });

  it('rejects inactive registry users', () => {
    masterDb.getQuery = () => undefined;
    const req = { query: {}, headers: { 'x-api-key': apiKey }, body: {} };
    const res = mockRes();
    let nextCalled = false;
    requireRegisteredUser(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('rejects malformed API keys', () => {
    const req = { query: {}, headers: { 'x-api-key': 'short' }, body: {} };
    const res = mockRes();
    let nextCalled = false;
    requireRegisteredUser(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(400);
  });
});

describe('requireInternalServiceAuth', () => {
  it('allows requests when BACKEND_SERVICE_SECRET is unset (backward compatible)', () => {
    const prev = process.env.BACKEND_SERVICE_SECRET;
    delete process.env.BACKEND_SERVICE_SECRET;
    const req = { headers: {}, originalUrl: '/test' };
    const res = mockRes();
    let nextCalled = false;
    requireInternalServiceAuth(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    if (prev) process.env.BACKEND_SERVICE_SECRET = prev;
  });

  it('rejects when secret is set but header is missing', () => {
    process.env.BACKEND_SERVICE_SECRET = 'test-service-secret-min-16-chars';
    const req = { headers: {}, originalUrl: '/test' };
    const res = mockRes();
    let nextCalled = false;
    requireInternalServiceAuth(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('accepts matching x-backend-service-secret', () => {
    process.env.BACKEND_SERVICE_SECRET = 'test-service-secret-min-16-chars';
    const req = {
      headers: { 'x-backend-service-secret': process.env.BACKEND_SERVICE_SECRET },
      originalUrl: '/test',
    };
    const res = mockRes();
    let nextCalled = false;
    requireInternalServiceAuth(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
