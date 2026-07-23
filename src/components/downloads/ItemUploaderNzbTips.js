export default function ItemUploaderNzbTips({ nzbTipsHidden, onHide, onShow, t }) {
  if (!nzbTipsHidden) {
    return (
      <div className="mt-3 p-3 bg-accent/10 dark:bg-accent-dark/10 border border-accent/25 dark:border-accent-dark/25 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            <svg
              className="size-5 text-accent dark:text-accent-dark mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-primary-text dark:text-primary-text-dark">
              <p className="font-medium">{t('help.nzbTips')}</p>
              <ul className="mt-1 text-xs space-y-1">
                <li>• {t('help.validLinks')}</li>
                <li>• {t('help.checkApiKey')}</li>
                <li>• {t('help.serverErrors')}</li>
                <li>• {t('help.downloadSlots')}</li>
                <li>• {t('help.uploadLimit')}</li>
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={onHide}
            className="ml-2 p-1 text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            aria-label="Hide tips"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        onClick={onShow}
        className="flex items-center gap-2 px-3 py-2 text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded-lg transition-all duration-200"
      >
        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Show NZB Tips
      </button>
    </div>
  );
}
