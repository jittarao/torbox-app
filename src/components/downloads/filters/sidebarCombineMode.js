/** Sidebar multi-select combine modes: any = OR, all = AND. */
export const COMBINE_MODES = {
  ANY: 'any',
  ALL: 'all',
};

const COMBINE_MODE_PARAM_KEYS = {
  views: 'viewsOp',
  tags: 'tagsOp',
  trackers: 'trackersOp',
  sources: 'sourcesOp',
};

/**
 * @param {string|null|undefined} raw
 * @returns {'any'|'all'}
 */
export function parseCombineModeParam(raw) {
  if (raw === COMBINE_MODES.ALL) return COMBINE_MODES.ALL;
  return COMBINE_MODES.ANY;
}

/**
 * @param {'any'|'all'|null|undefined} mode
 * @returns {boolean}
 */
export function isAllCombineMode(mode) {
  return mode === COMBINE_MODES.ALL;
}

/**
 * @param {URLSearchParams} searchParams
 * @param {'views'|'tags'|'trackers'|'sources'} section
 * @returns {'any'|'all'}
 */
export function parseSectionCombineModeFromParams(searchParams, section) {
  const key = COMBINE_MODE_PARAM_KEYS[section];
  return parseCombineModeParam(searchParams.get(key));
}

/**
 * @param {URLSearchParams} params
 * @param {'views'|'tags'|'trackers'|'sources'} section
 * @param {'any'|'all'|null|undefined} mode
 */
export function writeSectionCombineModeToParams(params, section, mode) {
  const key = COMBINE_MODE_PARAM_KEYS[section];
  if (isAllCombineMode(mode)) {
    params.set(key, COMBINE_MODES.ALL);
  } else {
    params.delete(key);
  }
}

/**
 * @param {URLSearchParams} params
 */
export function clearSectionCombineModeParams(params) {
  for (const key of Object.values(COMBINE_MODE_PARAM_KEYS)) {
    params.delete(key);
  }
}

export { COMBINE_MODE_PARAM_KEYS };
