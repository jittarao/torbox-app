/** TorBox mylist max page size; matches frontend fetchTorboxDownloadList.js */
export const MYLIST_PAGE_LIMIT = 1000;

const FULL_PAGINATION_ENV = 'TORBOX_MYLIST_FULL_PAGINATION';

/**
 * When true, backend fetches every TorBox mylist page (required for automation on libraries >1000).
 * Default false: first API page only (~1000 newest items), matching legacy behavior.
 * @returns {boolean}
 */
export function isTorboxMylistFullPaginationEnabled() {
  const raw = process.env[FULL_PAGINATION_ENV];
  if (raw == null || raw === '') return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/**
 * Fetch the first TorBox mylist page (no offset/limit — API default page).
 * @param {Object} options
 * @param {import('axios').AxiosInstance} options.client
 * @param {string} options.endpoint
 * @param {boolean} [options.bypassCache]
 * @param {number} [options.timeout]
 * @returns {Promise<{ items: object[], pageCount: number }>}
 */
export async function fetchFirstMyListPage({ client, endpoint, bypassCache = false, timeout }) {
  const response = await client.get(endpoint, {
    params: { bypass_cache: bypassCache },
    timeout,
  });
  const items = Array.isArray(response.data?.data) ? response.data.data : [];
  return { items, pageCount: 1 };
}

/**
 * Fetch mylist using full pagination when TORBOX_MYLIST_FULL_PAGINATION is enabled.
 * @param {Object} options
 * @param {import('axios').AxiosInstance} options.client
 * @param {string} options.endpoint
 * @param {boolean} [options.bypassCache]
 * @param {number} [options.timeout]
 * @returns {Promise<{ items: object[], pageCount: number }>}
 */
export async function fetchMyList(options) {
  if (isTorboxMylistFullPaginationEnabled()) {
    return fetchAllMyListPages(options);
  }
  return fetchFirstMyListPage(options);
}

/**
 * Fetch all pages of a TorBox mylist endpoint (newest-first; older items live on later pages).
 * @param {Object} options
 * @param {import('axios').AxiosInstance} options.client
 * @param {string} options.endpoint - e.g. '/api/torrents/mylist'
 * @param {boolean} [options.bypassCache]
 * @param {number} [options.timeout]
 * @returns {Promise<{ items: object[], pageCount: number }>}
 */
export async function fetchAllMyListPages({ client, endpoint, bypassCache = false, timeout }) {
  const regularById = new Map();
  let offset = 0;
  let pageCount = 0;

  while (true) {
    const response = await client.get(endpoint, {
      params: {
        bypass_cache: bypassCache,
        offset,
        limit: MYLIST_PAGE_LIMIT,
      },
      timeout,
    });

    const page = Array.isArray(response.data?.data) ? response.data.data : [];
    pageCount += 1;
    for (const item of page) {
      regularById.set(item.id, item);
    }
    if (page.length < MYLIST_PAGE_LIMIT) break;
    offset += MYLIST_PAGE_LIMIT;
  }

  return { items: [...regularById.values()], pageCount };
}

/**
 * Merge regular mylist rows with queued rows; mylist wins on duplicate id.
 * @param {object[]} myListItems
 * @param {object[]} queuedItems
 * @param {(item: object, options?: { queued?: boolean }) => object} normalizeItem
 * @returns {object[]}
 */
export function mergeMyListWithQueued(myListItems, queuedItems, normalizeItem) {
  const byId = new Map();

  for (const item of myListItems || []) {
    byId.set(item.id, normalizeItem(item));
  }

  for (const item of queuedItems || []) {
    if (!byId.has(item.id)) {
      byId.set(item.id, normalizeItem(item, { queued: true }));
    }
  }

  return [...byId.values()];
}
