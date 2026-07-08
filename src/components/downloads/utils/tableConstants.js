/** Max file rows inlined per expanded item in the virtualized table before an overflow row. */
export const MAX_INLINE_FILE_ROWS = 80;

/** content-visibility hints for virtualized table item rows (match estimateSize desktop heights). */
export const TABLE_ROW_CONTENT_VISIBILITY = {
  contentVisibility: 'auto',
  containIntrinsicSize: '58px',
};

export const TABLE_FILE_ROW_CONTENT_VISIBILITY = {
  contentVisibility: 'auto',
  containIntrinsicSize: '48px',
};

/** content-visibility hint for virtualized card list rows. */
export const CARD_ROW_CONTENT_VISIBILITY = {
  contentVisibility: 'auto',
  containIntrinsicSize: '100px',
};
