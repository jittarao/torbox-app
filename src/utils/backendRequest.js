/**
 * Headers for Next.js → backend proxy requests.
 * Sends x-backend-service-secret only when BACKEND_SERVICE_SECRET is configured (optional).
 */
export function backendProxyHeaders(apiKey, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  const serviceSecret = process.env.BACKEND_SERVICE_SECRET;
  if (serviceSecret && serviceSecret.trim().length >= 16) {
    headers['x-backend-service-secret'] = serviceSecret;
  }
  return headers;
}

/**
 * fetch() wrapper that always forwards x-api-key (and optional service secret) to the backend.
 */
export function backendFetch(
  url,
  { apiKey, method = 'GET', body, headers: extraHeaders, ...rest } = {}
) {
  const headers = backendProxyHeaders(apiKey, {
    ...(body !== undefined && body !== null ? { 'Content-Type': 'application/json' } : {}),
    ...extraHeaders,
  });

  return fetch(url, {
    method,
    cache: 'no-store',
    ...rest,
    headers,
    body:
      body === undefined || body === null
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
  });
}
