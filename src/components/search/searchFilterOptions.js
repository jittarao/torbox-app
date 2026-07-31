/**
 * Preset options for stream search filters (dropdowns).
 * Codec/HDR filters use alias lists so common synonyms match.
 */

export const RESOLUTION_OPTIONS = [
  { value: '', labelKey: 'filters.any' },
  { value: '2160p', label: '2160p / 4K' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];

/** value stored in URL; matchAliases used by client filter */
export const CODEC_OPTIONS = [
  { value: '', labelKey: 'filters.any' },
  { value: 'hevc', label: 'HEVC / x265', matchAliases: ['hevc', 'x265', 'h265', 'h.265'] },
  { value: 'avc', label: 'AVC / x264', matchAliases: ['avc', 'x264', 'h264', 'h.264'] },
  { value: 'av1', label: 'AV1', matchAliases: ['av1'] },
  { value: 'vp9', label: 'VP9', matchAliases: ['vp9'] },
];

export const HDR_OPTIONS = [
  { value: '', labelKey: 'filters.any' },
  { value: 'HDR', label: 'HDR / HDR10', matchAliases: ['HDR', 'HDR10', 'HDR10+'] },
  { value: 'DV', label: 'Dolby Vision', matchAliases: ['DV', 'DOVI'] },
  { value: 'HLG', label: 'HLG', matchAliases: ['HLG'] },
];

export const LANGUAGE_OPTIONS = [
  { value: '', labelKey: 'filters.any' },
  { value: 'ENG', label: 'English', matchAliases: ['eng', 'english'] },
  { value: 'Multi', label: 'Multi / Dual', matchAliases: ['multi', 'dual'] },
  { value: 'JPN', label: 'Japanese', matchAliases: ['jpn', 'japanese'] },
  { value: 'SPA', label: 'Spanish', matchAliases: ['spa', 'spanish'] },
  { value: 'FRE', label: 'French', matchAliases: ['fre', 'french'] },
  { value: 'GER', label: 'German', matchAliases: ['ger', 'german'] },
  { value: 'ITA', label: 'Italian', matchAliases: ['ita', 'italian'] },
  { value: 'RUS', label: 'Russian', matchAliases: ['rus', 'russian'] },
  { value: 'POR', label: 'Portuguese', matchAliases: ['por', 'portuguese'] },
  { value: 'CHI', label: 'Chinese', matchAliases: ['chi', 'chinese'] },
  { value: 'KOR', label: 'Korean', matchAliases: ['kor', 'korean'] },
  { value: 'HIN', label: 'Hindi', matchAliases: ['hin', 'hindi'] },
  { value: 'TEL', label: 'Telugu', matchAliases: ['tel', 'telugu'] },
  { value: 'TAM', label: 'Tamil', matchAliases: ['tam', 'tamil'] },
  { value: 'THA', label: 'Thai', matchAliases: ['tha', 'thai'] },
  { value: 'VIET', label: 'Vietnamese', matchAliases: ['viet', 'vietnamese'] },
  { value: 'ID', label: 'Indonesian', matchAliases: ['id', 'indonesian'] },
  { value: 'PHI', label: 'Filipino', matchAliases: ['phi', 'filipino'] },
  { value: 'MAL', label: 'Malay', matchAliases: ['mal', 'malay'] },
  { value: 'ARAB', label: 'Arabic', matchAliases: ['arab', 'arabic'] },
];

export const MIN_SIZE_OPTIONS = [
  { value: '', labelKey: 'filters.any' },
  { value: '1', label: '1 GB+' },
  { value: '2', label: '2 GB+' },
  { value: '5', label: '5 GB+' },
  { value: '10', label: '10 GB+' },
  { value: '20', label: '20 GB+' },
  { value: '40', label: '40 GB+' },
];

export const MAX_SIZE_OPTIONS = [
  { value: '', labelKey: 'filters.any' },
  { value: '1', label: 'Under 1 GB' },
  { value: '2', label: 'Under 2 GB' },
  { value: '5', label: 'Under 5 GB' },
  { value: '10', label: 'Under 10 GB' },
  { value: '20', label: 'Under 20 GB' },
  { value: '40', label: 'Under 40 GB' },
];

export function getCodecMatchAliases(value) {
  const opt = CODEC_OPTIONS.find((o) => o.value === value);
  return opt?.matchAliases || (value ? [String(value).toLowerCase()] : []);
}

export function getHdrMatchAliases(value) {
  const opt = HDR_OPTIONS.find((o) => o.value === value);
  if (opt?.matchAliases) return opt.matchAliases;
  if (!value) return [];
  // Free-text / normalized values like HDR10+ still match the HDR bucket.
  const upper = String(value).toUpperCase();
  if (upper.startsWith('HDR')) return ['HDR', 'HDR10', 'HDR10+'];
  return [upper];
}

export function getLanguageMatchAliases(value) {
  const opt = LANGUAGE_OPTIONS.find((o) => o.value === value);
  return opt?.matchAliases || (value ? [String(value).toLowerCase()] : []);
}
