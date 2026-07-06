/** Per-locale style hints embedded in translate plan output for AI agents. */
export const LOCALE_STYLES = {
  de: {
    formality: 'Formal "Sie"',
    quotationMarks: '„{query}" (U+201E lower-9, U+201C upper-6)',
    ellipsis: '…',
    examplePrefix: 'z. B.',
    icuPlurals: 'one, other',
    notes: 'Capitalize nouns. tag → Schlagwort/Schlagwörter. view → Ansicht. clear → Löschen.',
  },
  es: {
    formality: 'Formal "Usted" / "tu"',
    quotationMarks: '"{query}"',
    ellipsis: '…',
    examplePrefix: 'p. ej.',
    icuPlurals: 'one, other',
    notes: 'tag → etiqueta/etiquetas. view → vista. clear → Limpiar.',
  },
  fr: {
    formality: 'Formal "vous"',
    quotationMarks: '« {query} » with non-breaking spaces',
    ellipsis: '…',
    examplePrefix: 'ex.',
    icuPlurals: 'one, other',
    notes:
      'Non-breaking space before colon. tag → étiquette/étiquettes. view → vue. clear → Effacer.',
  },
  ja: {
    formality: 'Polite desu/masu style',
    quotationMarks: '「{query}」',
    ellipsis: '…',
    examplePrefix: '例:',
    icuPlurals: 'other only (no grammatical number)',
    notes:
      'Katakana loanwords for tech terms. tag → タグ. view → ビュー. clear → クリア. close → 閉じる. search → 検索.',
  },
  pl: {
    formality: 'Formal',
    quotationMarks: '„{query}"',
    ellipsis: '…',
    examplePrefix: 'np.',
    icuPlurals: 'one, few, many, other',
    notes:
      'Full Polish diacritics. Decline tag/tracker/widok/źródło in plurals. clear → Wyczyść. close → Zamknij.',
  },
};

export const GLOBAL_RULES = [
  'Preserve ICU MessageFormat syntax ({count, plural, ...}) and simple {placeholders} exactly.',
  'Do not translate proper nouns (TorBox, GitHub, IINA, Infuse, Stremio) or platform names (macOS, iOS, Windows, Linux).',
  'Skip keys where the target-language value is identical to English — they inherit from en.json.',
  'Never translate Admin.* keys.',
];

export function styleForLocale(locale) {
  return LOCALE_STYLES[locale] || null;
}
