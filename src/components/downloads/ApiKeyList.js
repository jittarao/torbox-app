import { Check, Delete } from '@/components/icons';
import { getKeyInitials, maskApiKey } from './apiKeyManagerHelpers';

export default function ApiKeyList({
  keys,
  activeKey,
  compact,
  textSm,
  rowPad,
  t,
  onSelectKey,
  onDeleteKey,
  onShowAddForm,
}) {
  if (keys.length === 0) {
    return (
      <p
        className={`text-center text-primary-text/45 dark:text-primary-text-dark/45 leading-snug ${compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'}`}
      >
        {t('noKeys')}{' '}
        <button
          type="button"
          onClick={onShowAddForm}
          className="text-accent dark:text-accent-dark hover:underline touch-manipulation font-medium"
        >
          {t('addKey')}
        </button>
      </p>
    );
  }

  return (
    <ul
      className="flex flex-col gap-0.5 max-h-[min(28vh,11rem)] overflow-y-auto overscroll-contain"
      role="list"
    >
      {keys.map((keyItem) => {
        const isActive = activeKey === keyItem.key;
        return (
          <li key={keyItem.key} className="min-w-0">
            <div
              className={`group flex items-center gap-1.5 rounded-md border min-w-0 ${rowPad}
                ${
                  isActive
                    ? 'border-accent/40 bg-surface-alt-selected dark:border-accent-dark/40 dark:bg-surface-alt-selected-dark'
                    : 'border-transparent hover:border-border/60 hover:bg-surface-alt dark:hover:border-border-dark/60 dark:hover:bg-surface-alt-dark'
                }`}
            >
              <button
                type="button"
                onClick={() => onSelectKey(keyItem)}
                className="flex flex-1 items-center gap-1.5 min-w-0 text-left touch-manipulation rounded
                  focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40"
              >
                <span
                  className={`flex shrink-0 items-center justify-center size-6 rounded font-semibold text-[9px] uppercase
                    ${
                      isActive
                        ? 'bg-accent text-white dark:bg-accent-dark'
                        : 'bg-surface dark:bg-surface-dark text-primary-text/60 dark:text-primary-text-dark/60 ring-1 ring-border/50 dark:ring-border-dark/50'
                    }`}
                  aria-hidden
                >
                  {getKeyInitials(keyItem.label)}
                </span>

                <span className="flex-1 min-w-0 leading-tight">
                  <span className="flex items-center gap-1 min-w-0">
                    <span
                      className={`font-medium truncate text-primary-text dark:text-primary-text-dark ${compact ? 'text-xs' : 'text-sm'}`}
                    >
                      {keyItem.label}
                    </span>
                    {isActive && (
                      <Check
                        className="size-3 shrink-0 text-accent dark:text-accent-dark"
                        aria-hidden
                      />
                    )}
                  </span>
                  <span
                    className={`block font-mono truncate text-primary-text/45 dark:text-primary-text-dark/45 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
                  >
                    {maskApiKey(keyItem.key)}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDeleteKey(keyItem.key)}
                className="shrink-0 rounded p-1 text-primary-text/40 hover:text-red-500 hover:bg-red-500/10
                  dark:text-primary-text-dark/40 dark:hover:text-red-400 transition-colors touch-manipulation
                  h-7 w-7 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                aria-label={t('deleteKey')}
                title={t('deleteKey')}
              >
                <Delete className="size-3.5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
