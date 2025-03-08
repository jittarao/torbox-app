'use client';

import Icons from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';

export default function TorrentOptions({
  showOptions,
  globalOptions,
  updateGlobalOptions,
}) {
  const t = useTranslations('TorrentOptions');

  return (
    <div
      className={`${showOptions ? 'mt-4' : 'mt-0'} transition-all duration-300 ease-in-out overflow-hidden ${
        showOptions ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className="bg-surface-alt/50 dark:bg-surface-alt-dark p-4 rounded-lg 
          border border-border dark:border-border-dark"
      >
        <div className="flex flex-col xl:flex-row">
          {/* Left Section - Global Upload Options */}
          <div className="flex-1 xl:pr-6 mb-6 xl:mb-0">
            <h4 className="text-sm font-medium mb-4 text-primary-text dark:text-primary-text-dark">
              {t('title')}
            </h4>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="max-w-[200px]">
                <label
                  className="block text-xs text-primary-text/70 dark:text-primary-text-dark/70 
                    uppercase tracking-wide mb-1"
                >
                  {t('seedingPreference.label')}
                </label>
                <select
                  value={globalOptions.seed}
                  onChange={(e) =>
                    updateGlobalOptions({ seed: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-border dark:border-border-dark rounded-md 
                      bg-transparent text-primary-text dark:text-primary-text-dark 
                      focus:ring-1 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
                      focus:border-accent dark:focus:border-accent-dark transition-colors"
                >
                  <option value={1}>{t('seedingPreference.auto')}</option>
                  <option value={2}>{t('seedingPreference.always')}</option>
                  <option value={3}>{t('seedingPreference.never')}</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={globalOptions.allowZip}
                    onChange={(e) =>
                      updateGlobalOptions({ allowZip: e.target.checked })
                    }
                    className="w-4 h-4 accent-accent dark:accent-accent-dark"
                  />
                  <div>
                    <span
                      className="text-sm text-primary-text dark:text-primary-text-dark 
                        group-hover:text-primary dark:group-hover:text-primary-text-dark"
                    >
                      {t('allowZip.label')}
                    </span>
                    <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                      {t('allowZip.description')}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={globalOptions.asQueued}
                    onChange={(e) =>
                      updateGlobalOptions({ asQueued: e.target.checked })
                    }
                    className="w-4 h-4 accent-accent dark:accent-accent-dark"
                  />
                  <div>
                    <span
                      className="text-sm text-primary-text dark:text-primary-text-dark 
                        group-hover:text-primary dark:group-hover:text-primary-text-dark"
                    >
                      {t('instantQueue.label')}
                    </span>
                    <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                      {t('instantQueue.description')}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Vertical Divider - Only visible on md screens and up */}
          <div className="hidden xl:block w-px bg-border dark:bg-border-dark mx-6" />

          {/* Horizontal Divider - Only visible on mobile */}
          <div className="block xl:hidden h-px w-full bg-border dark:bg-border-dark my-4" />

          {/* Right Section - Auto Start Options */}
          <div className="flex-1 xl:pl-6">
            <div className="flex flex-col mb-4">
              <h4 className="text-sm font-medium text-primary-text dark:text-primary-text-dark flex items-center gap-2">
                {t('autoStart.title')}
                <Tooltip content={t('autoStart.tooltip')}>
                  <Icons.Question />
                </Tooltip>
              </h4>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={globalOptions.autoStart}
                  onChange={(e) =>
                    updateGlobalOptions({ autoStart: e.target.checked })
                  }
                  className="w-4 h-4 accent-accent dark:accent-accent-dark"
                />
                <span
                  className="text-sm text-primary-text dark:text-primary-text-dark 
                    group-hover:text-primary dark:group-hover:text-primary-text-dark"
                >
                  {t('autoStart.label')}
                </span>
              </label>

              <div className="flex items-center gap-2 ml-6">
                <span className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                  {t('autoStart.limit')}
                </span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={globalOptions.autoStartLimit ?? 3}
                  onChange={(e) => {
                    const value = Math.max(
                      1,
                      Math.min(10, parseInt(e.target.value) || 1),
                    );
                    updateGlobalOptions({ autoStartLimit: value });
                  }}
                  disabled={!globalOptions.autoStart}
                  className="w-16 text-sm p-1 border border-border dark:border-border-dark rounded
                      bg-transparent text-primary-text dark:text-primary-text-dark
                      disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
