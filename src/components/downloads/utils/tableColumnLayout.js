import { getActionsColumnWidthPx, getCheckboxColumnWidthPx } from './responsiveLayout';

/** Column that expands to consume leftover table width */
export const FLEX_COLUMN_ID = 'name';

/** Sensible defaults for fixed columns (name is computed, not stored by default) */
export const DEFAULT_COLUMN_WIDTHS = {
  id: 88,
  hash: 120,
  size: 96,
  created_at: 120,
  cached_at: 120,
  updated_at: 120,
  download_state: 112,
  progress: 128,
  download_progress: 140,
  ratio: 72,
  file_count: 80,
  download_speed: 100,
  upload_speed: 100,
  eta: 80,
  total_uploaded: 108,
  total_downloaded: 108,
  seeds: 72,
  peers: 72,
  original_url: 140,
  tracker: 140,
  expires_at: 120,
  asset_type: 96,
  private: 80,
  tags: 120,
};

export const COLUMN_MIN_WIDTHS = {
  name: 180,
  id: 72,
  download_state: 96,
  default: 64,
};

const DEFAULT_MIN_WIDTH = COLUMN_MIN_WIDTHS.default;

export function getColumnMinWidth(columnId) {
  return COLUMN_MIN_WIDTHS[columnId] ?? COLUMN_MIN_WIDTHS.default;
}

export function getColumnWidth(columnId, columnWidths, defaults = DEFAULT_COLUMN_WIDTHS) {
  const stored = columnWidths?.[columnId];
  if (stored != null) return stored;
  return defaults[columnId] ?? DEFAULT_MIN_WIDTH;
}

/**
 * Resolve pixel widths for every visible column.
 * Fixed columns use stored/default widths; name fills remaining viewport width.
 */
export function computeResolvedColumnWidths(activeColumns, columnWidths, tableWidth, isMobile) {
  const checkbox = getCheckboxColumnWidthPx();
  const actions = getActionsColumnWidthPx();

  if (isMobile) {
    const nameMin = getColumnMinWidth(FLEX_COLUMN_ID);
    const resolved = {};
    const nameWidth = tableWidth ? Math.max(nameMin, tableWidth - checkbox - actions) : nameMin;
    resolved[FLEX_COLUMN_ID] = nameWidth;
    return { resolved, checkbox, actions, tableMinWidth: null };
  }

  if (!tableWidth) {
    const resolved = {};
    for (const col of activeColumns) {
      resolved[col] = getColumnWidth(col, columnWidths, DEFAULT_COLUMN_WIDTHS);
    }
    return { resolved, checkbox, actions, tableMinWidth: null };
  }

  const fixedColumns = activeColumns.filter((c) => c !== FLEX_COLUMN_ID);
  let fixedSum = checkbox + actions;
  const resolved = {};

  for (const col of fixedColumns) {
    const w = getColumnWidth(col, columnWidths, DEFAULT_COLUMN_WIDTHS);
    resolved[col] = w;
    fixedSum += w;
  }

  const nameMin = getColumnMinWidth(FLEX_COLUMN_ID);
  const remaining = Math.max(0, tableWidth - fixedSum);
  const storedName = columnWidths?.[FLEX_COLUMN_ID];

  // No stored width → fill leftover space (content truncates, not content-sized)
  // Stored width → explicit user preference from resize handle
  const nameWidth =
    storedName != null ? Math.max(nameMin, storedName) : Math.max(nameMin, remaining);

  if (activeColumns.includes(FLEX_COLUMN_ID)) {
    resolved[FLEX_COLUMN_ID] = nameWidth;
  }

  const tableMinWidth = fixedSum + nameMin;

  return { resolved, checkbox, actions, tableMinWidth };
}

export function getResolvedColumnStyle(columnId, resolvedWidths, { isMobile = false } = {}) {
  if (isMobile && columnId !== FLEX_COLUMN_ID) return {};
  const width = resolvedWidths?.[columnId];
  if (!width) return {};
  return {
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  };
}
