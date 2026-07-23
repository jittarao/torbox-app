import { Play } from '@/components/icons';

export default function VideoInfoSearchMetadata({ searchMetadata }) {
  if (!searchMetadata) return null;

  return (
    <div className="bg-gradient-to-br from-accent/10 to-accent/5 dark:from-accent-dark/10 dark:to-accent-dark/5 rounded-lg p-5 border border-accent/20 dark:border-accent-dark/20">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Play className="size-5 text-accent dark:text-accent-dark" />
        Media Information
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {searchMetadata.title && (
          <div className="md:col-span-2">
            <span className="text-xs text-white/60 uppercase tracking-wide">Title</span>
            <p className="text-lg font-medium text-white mt-1">{searchMetadata.title}</p>
          </div>
        )}
        {searchMetadata.description && (
          <div className="md:col-span-2">
            <span className="text-xs text-white/60 uppercase tracking-wide">Description</span>
            <p className="text-sm text-white/80 mt-1 leading-relaxed">
              {searchMetadata.description}
            </p>
          </div>
        )}
        {searchMetadata.genres && searchMetadata.genres.length > 0 && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Genres</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchMetadata.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark text-xs font-medium border border-accent/30 dark:border-accent-dark/30"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}
        {searchMetadata.keywords && searchMetadata.keywords.length > 0 && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Keywords</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchMetadata.keywords.slice(0, 8).map((keyword) => (
                <span key={keyword} className="px-2 py-1 rounded bg-white/5 text-white/70 text-xs">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
        {searchMetadata.rating && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Rating</span>
            <p className="text-lg font-semibold text-white mt-1 flex items-center gap-2">
              <span className="text-accent dark:text-accent-dark">★</span>
              {searchMetadata.rating}/10
            </p>
          </div>
        )}
        {searchMetadata.releaseYears && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Release Year</span>
            <p className="text-lg font-medium text-white mt-1">{searchMetadata.releaseYears}</p>
          </div>
        )}
        {searchMetadata.runtime && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Runtime</span>
            <p className="text-lg font-medium text-white mt-1">{searchMetadata.runtime}</p>
          </div>
        )}
        {searchMetadata.contentRating && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Content Rating</span>
            <p className="text-lg font-medium text-white mt-1">{searchMetadata.contentRating}</p>
          </div>
        )}
        {searchMetadata.mediaType && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Type</span>
            <p className="text-lg font-medium text-white mt-1 capitalize">
              {searchMetadata.mediaType}
            </p>
          </div>
        )}
        {searchMetadata.languages && searchMetadata.languages.length > 0 && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Languages</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchMetadata.languages.map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-1 rounded bg-white/5 text-white/80 text-xs font-medium"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
        {searchMetadata.imdb_id && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">IMDb ID</span>
            <p className="text-sm font-mono text-white/80 mt-1">{searchMetadata.imdb_id}</p>
          </div>
        )}
      </div>
    </div>
  );
}
