import { useId } from 'react';
import { Check } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';

export default function RssFeedForm({
  t,
  editingFeed,
  formData,
  onFormDataChange,
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const downloadTypeId = useId();
  const torrentSeedingId = useId();
  const feedNameId = useId();
  const feedUrlId = useId();
  const doRegexId = useId();
  const dontRegexId = useId();
  const scanIntervalId = useId();
  const dontOlderThanId = useId();

  return (
    <div className="bg-surface-alt dark:bg-surface-alt-dark p-6 rounded-lg border border-border dark:border-border-dark">
      <h3 className="text-lg font-medium mb-4 text-primary-text dark:text-primary-text-dark">
        {editingFeed ? t('editFeed') : t('addFeed')}
      </h3>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={feedNameId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('feedName')}
            </label>
            <input
              id={feedNameId}
              type="text"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder={t('feedNamePlaceholder')}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label
              htmlFor={feedUrlId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('feedUrl')}
            </label>
            <input
              id={feedUrlId}
              type="url"
              value={formData.url}
              onChange={(e) => onFormDataChange({ ...formData, url: e.target.value })}
              placeholder={t('feedUrlPlaceholder')}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={downloadTypeId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('downloadType')}
            </label>
            <select
              id={downloadTypeId}
              value={formData.rss_type}
              onChange={(e) => onFormDataChange({ ...formData, rss_type: e.target.value })}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="torrent">{t('options.torrent')}</option>
              <option value="usenet">{t('options.usenet')}</option>
              <option value="webdl">{t('options.webdl')}</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={torrentSeedingId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('torrentSeeding')}
            </label>
            <select
              id={torrentSeedingId}
              value={formData.torrent_seeding}
              onChange={(e) =>
                onFormDataChange({ ...formData, torrent_seeding: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={1}>{t('options.auto')}</option>
              <option value={2}>{t('options.seed')}</option>
              <option value={3}>{t('options.dontSeed')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={doRegexId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('doRegex')}
            </label>
            <input
              id={doRegexId}
              type="text"
              value={formData.do_regex}
              onChange={(e) => onFormDataChange({ ...formData, do_regex: e.target.value })}
              placeholder={t('doRegexPlaceholder')}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor={dontRegexId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('dontRegex')}
            </label>
            <input
              id={dontRegexId}
              type="text"
              value={formData.dont_regex}
              onChange={(e) => onFormDataChange({ ...formData, dont_regex: e.target.value })}
              placeholder={t('dontRegexPlaceholder')}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={scanIntervalId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('scanInterval')}
            </label>
            <input
              id={scanIntervalId}
              type="number"
              min="1"
              value={formData.scan_interval}
              onChange={(e) =>
                onFormDataChange({ ...formData, scan_interval: parseInt(e.target.value) || 60 })
              }
              placeholder={t('scanIntervalPlaceholder')}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor={dontOlderThanId}
              className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
            >
              {t('dontOlderThan')}
            </label>
            <input
              id={dontOlderThanId}
              type="number"
              min="0"
              value={formData.dont_older_than}
              onChange={(e) =>
                onFormDataChange({ ...formData, dont_older_than: parseInt(e.target.value) || 0 })
              }
              placeholder={t('dontOlderThanPlaceholder')}
              className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
            <input
              type="checkbox"
              checked={formData.pass_check}
              onChange={(e) => onFormDataChange({ ...formData, pass_check: e.target.checked })}
              className="rounded border-border dark:border-border-dark text-accent focus:ring-accent"
            />
            {t('passCheck')}
          </label>
          <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
            {t('passCheckDescription')}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size="sm" /> : <Check className="size-4" />}
            {t('save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
