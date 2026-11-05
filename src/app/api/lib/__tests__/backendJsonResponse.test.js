import { describe, expect, test } from 'bun:test';
import { backendJsonResponse } from '../backendJsonResponse.js';

describe('backendJsonResponse', () => {
  test('forwards a successful JSON body and status', async () => {
    const response = new Response(JSON.stringify({ success: true, id: 7 }), { status: 201 });
    const forwarded = await backendJsonResponse(response);

    expect(forwarded.status).toBe(201);
    expect(await forwarded.json()).toEqual({ success: true, id: 7 });
  });

  test('passes through a non-2xx error body', async () => {
    const response = new Response(JSON.stringify({ success: false, error: 'nope' }), {
      status: 422,
    });
    const forwarded = await backendJsonResponse(response);

    expect(forwarded.status).toBe(422);
    expect(await forwarded.json()).toEqual({ success: false, error: 'nope' });
  });

  test('keeps the status but replaces an empty error body with a generic error', async () => {
    const response = new Response('', { status: 502 });
    const forwarded = await backendJsonResponse(response);

    expect(forwarded.status).toBe(502);
    expect(await forwarded.json()).toEqual({
      success: false,
      error: 'Backend request failed (502)',
    });
  });
});
