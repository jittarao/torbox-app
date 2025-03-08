import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function SearchBar({ search, onSearchChange }) {
  const t = useTranslations();
  return (
    <div className="relative flex-1">
      <div
        className="absolute left-3 top-1/2 transform -translate-y-1/2 
                   text-primary-text/40 dark:text-primary-text-dark/40"
      >
        <Icons.MagnifyingGlass />
      </div>
      <input
        type="text"
        placeholder={t('SearchBar.placeholder', {
          itemType: t('Common.itemTypes.torrents'),
        })}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-10 pr-10 py-2 min-w-64 rounded-lg border border-border dark:border-border-dark 
          bg-transparent text-primary-text dark:text-primary-text-dark 
          placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
          focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
          focus:border-accent dark:focus:border-accent-dark 
          transition-colors text-sm"
      />
      {search && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 
            text-primary-text/40 dark:text-primary-text-dark/40 
            hover:text-primary-text dark:hover:text-primary-text-dark
            transition-colors"
        >
          <Icons.Times />
        </button>
      )}
    </div>
  );
}
