export function getKeyInitials(label) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (label.trim().slice(0, 2) || '?').toUpperCase();
}

export function maskApiKey(key) {
  if (key.length <= 16) return key;
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

export function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors touch-manipulation
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40
        ${checked ? 'bg-accent dark:bg-accent-dark' : 'bg-border/80 dark:bg-border-dark/80'}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}
