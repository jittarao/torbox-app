/**
 * Read JSON from a fetch Response only after checking HTTP status.
 * fetch() resolves on 4xx/5xx — callers must not treat the body as success without this check.
 */
export async function readJsonFromResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return { ok: false, status: response.status, data };
  }

  const data = await response.json();
  return { ok: true, status: response.status, data };
}
