/**
 * Shared responsive breakpoints for JS hooks and Tailwind `md`.
 *
 * Portrait phones match via max-width. Landscape phones stay mobile via short
 * viewport height (e.g. iPhone 14 landscape is ~844×390).
 */
const MOBILE_MEDIA_QUERY = '(max-width: 767px), (max-height: 500px) and (orientation: landscape)';

/** Logical inverse of MOBILE_MEDIA_QUERY — used for Tailwind `md:` */
const DESKTOP_MD_MEDIA_QUERY =
  '(min-width: 768px) and ((min-height: 501px) or (orientation: portrait))';

module.exports = { MOBILE_MEDIA_QUERY, DESKTOP_MD_MEDIA_QUERY };
