import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';

/** TorBox mylist max page size; catalogs with fewer regular rows fit in one page. */
export const MYLIST_PAGE_LIMIT = 1000;

const PAGE_LIMIT = MYLIST_PAGE_LIMIT;

/** @type {Record<string, { mylistPath: string, queuedType: string }>} */
const ASSET_CONFIG = {
  torrents: {
    mylistPath: 'torrents',
    queuedType: 'torrent',
  },
  usenet: {
    mylistPath: 'usenet',
    queuedType: 'usenet',
  },
  webdl: {
    mylistPath: 'webdl',
    queuedType: 'webdl',
  },
};

function torboxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

/**
 * @param {object} item
 */
export function addedTimestamp(item) {
  return item?.added ?? item?.created_at ?? 0;
}

/**
 * Sort by added/created_at descending (matches client merge order).
 * @param {object[]} items
 */
export function sortByAddedDesc(items) {
  if (!items?.length) return [];
  return [...items].sort(
    (a, b) => new Date(addedTimestamp(b)).getTime() - new Date(addedTimestamp(a)).getTime()
  );
}

/**
 * Merge regular mylist rows with queued rows; regular wins on duplicate id.
 * @param {object[]} regular
 * @param {object[]} queued
 */
export function mergeRegularAndQueued(regular, queued) {
  const byId = new Map();
  for (const item of regular || []) {
    byId.set(item.id, item);
  }
  for (const item of queued || []) {
    if (!byId.has(item.id)) {
      byId.set(item.id, { ...item, status: 'queued' });
    }
  }
  return sortByAddedDesc([...byId.values()]);
}

/**
 * @param {string} apiKey
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 * @param {{ offset?: number, limit?: number }} [options]
 */
export async function fetchMyListPage(apiKey, assetType, { offset = 0, limit = PAGE_LIMIT } = {}) {
  const config = ASSET_CONFIG[assetType];
  if (!config) {
    throw new Error(`Unknown asset type: ${assetType}`);
  }

  const timestamp = Date.now();
  const url =
    `${API_BASE}/${API_VERSION}/api/${config.mylistPath}/mylist` +
    `?bypass_cache=true&offset=${offset}&limit=${limit}&_t=${timestamp}`;

  const response = await torboxFetch(url, {
    cache: 'no-store',
    headers: torboxHeaders(apiKey),
  });

  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `TorBox mylist failed with status ${response.status}`);
  }

  return {
    success: body.success !== false,
    data: Array.isArray(body.data) ? body.data : [],
  };
}

/**
 * @param {string} apiKey
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 */
export async function fetchQueuedList(apiKey, assetType) {
  const config = ASSET_CONFIG[assetType];
  if (!config) {
    throw new Error(`Unknown asset type: ${assetType}`);
  }

  const timestamp = Date.now();
  const url =
    `${API_BASE}/${API_VERSION}/api/queued/getqueued` +
    `?type=${config.queuedType}&bypass_cache=true&_t=${timestamp}`;

  const response = await torboxFetch(url, {
    cache: 'no-store',
    headers: torboxHeaders(apiKey),
  });

  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `TorBox getqueued failed with status ${response.status}`);
  }

  return {
    success: body.success !== false,
    data: Array.isArray(body.data) ? body.data : [],
  };
}

/**
 * Page 0 mylist + full queued list (shallow poll input).
 * @param {string} apiKey
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 */
export async function fetchShallowDownloadList(apiKey, assetType) {
  const [regular, queued] = await Promise.all([
    fetchMyListPage(apiKey, assetType, { offset: 0, limit: PAGE_LIMIT }),
    fetchQueuedList(apiKey, assetType),
  ]);

  return {
    success: regular.success && queued.success,
    data: mergeRegularAndQueued(regular.data, queued.data),
    regularPageLength: regular.data.length,
  };
}

/**
 * All mylist pages + queued (full reconciliation).
 * @param {string} apiKey
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 */
export async function fetchFullDownloadList(apiKey, assetType) {
  /** @type {Map<number|string, object>} */
  const regularById = new Map();
  let offset = 0;
  let pageCount = 0;

  while (true) {
    const page = await fetchMyListPage(apiKey, assetType, { offset, limit: PAGE_LIMIT });
    pageCount += 1;
    for (const item of page.data) {
      regularById.set(item.id, item);
    }
    if (page.data.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  const queued = await fetchQueuedList(apiKey, assetType);

  return {
    success: queued.success,
    data: mergeRegularAndQueued([...regularById.values()], queued.data),
    pageCount,
  };
}
