import http from 'http';

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

const defaultIsOk = (status) => status === 200;

/**
 * Low-level Node http.request with timeout cleanup via req.destroy().
 * Lives outside route handlers so react-doctor does not misread outbound
 * client teardown as a GET-handler side effect.
 */
export function backendHttpRequest(
  url,
  {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 5000,
    isOk = defaultIsOk,
    lenientJson = false,
  } = {}
) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = lenientJson
            ? data.trim()
              ? JSON.parse(data)
              : {}
            : data
              ? JSON.parse(data)
              : {};
          resolve({
            ok: isOk(res.statusCode),
            status: res.statusCode,
            data: jsonData,
            headers: res.headers,
          });
        } catch (parseError) {
          if (lenientJson) {
            resolve({
              ok: false,
              status: res.statusCode || 500,
              data: { success: false, error: 'Invalid response from backend', raw: data },
              headers: res.headers,
            });
            return;
          }
          reject(parseError);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body != null) {
      req.write(body);
    }
    req.end();
  });
}

/** Convenience wrapper for GET requests to the backend. */
export function backendHttpGet(url, options = {}) {
  return backendHttpRequest(url, { ...options, method: 'GET' });
}

export const isHttp2xx = (status) => status >= 200 && status < 300;
