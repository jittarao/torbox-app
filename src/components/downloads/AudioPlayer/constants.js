/** Single localStorage key for all audio player settings (JSON object). */
export const AUDIO_STORAGE_KEY = 'audio-settings';
/** Save position to localStorage at most every this many seconds during playback */
export const POSITION_SAVE_INTERVAL_SEC = 3;
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];
export const SKIP_SECONDS = 15;
/** Long-press skip amount (e.g. 60s); short tap uses SKIP_SECONDS */
export const SKIP_SECONDS_LONG = 60;
/** Hold skip button this long (ms) to trigger long skip */
export const SKIP_LONG_PRESS_MS = 500;
export const SLEEP_TIMER_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hr', value: 60 },
  { label: 'End of chapter', value: 'end' },
];
