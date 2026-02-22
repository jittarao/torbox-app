'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { formatTime } from '../utils/formatters';
import Spinner from '@/components/shared/Spinner';

function filterChapters(chapters, query) {
  if (!query.trim()) return chapters.map((ch, i) => ({ ch, i }));
  const q = query.trim().toLowerCase();
  return chapters
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch, i }) => {
      const numMatch = String(i + 1) === q || String(i + 1).padStart(2, '0') === q;
      const titleMatch = (ch.title || '').toLowerCase().includes(q);
      return numMatch || titleMatch;
    });
}

export default function ChaptersPanel({
  chapters,
  chaptersLoading,
  currentChapterIndex,
  showChaptersPanel,
  onToggleChapters,
  onSelectChapter,
}) {
  const listRef = useRef(null);
  const currentChapterRef = useRef(null);
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');

  const filteredEntries = useMemo(
    () => filterChapters(chapters, chapterSearchQuery),
    [chapters, chapterSearchQuery]
  );

  // When panel opens or current chapter changes, scroll only if current chapter is not already visible (avoids jerk)
  useEffect(() => {
    if (!showChaptersPanel || chapters.length === 0 || currentChapterIndex < 0) return;
    const el = currentChapterRef.current;
    const list = listRef.current;
    if (!el || !list) return;
    const id = setTimeout(() => {
      const listRect = list.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const padding = 48;
      const isInView =
        elRect.top >= listRect.top - padding &&
        elRect.bottom <= listRect.bottom + padding;
      if (!isInView) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(id);
  }, [showChaptersPanel, currentChapterIndex, chapters.length]);

  if (!showChaptersPanel) return null;

  return (
    <div className="mt-4 flex-1 min-h-0 flex flex-col border-t border-white/10 pt-4 md:mt-0 md:border-t-0 md:pt-0">
      <div className="flex items-center justify-between mb-3 px-0.5 shrink-0 gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0">
          Chapters
        </h2>
        {!chaptersLoading && chapters.length > 0 && (
          <span className="text-xs text-gray-400 tabular-nums shrink-0">
            {currentChapterIndex >= 0 ? currentChapterIndex + 1 : 0} / {chapters.length}
          </span>
        )}
      </div>

      {!chaptersLoading && chapters.length > 0 && (
        <input
          type="search"
          placeholder="Search chapters…"
          value={chapterSearchQuery}
          onChange={(e) => setChapterSearchQuery(e.target.value)}
          className="mb-3 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
          aria-label="Search chapters by number or name"
        />
      )}

      {chaptersLoading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-8 rounded-xl bg-white/[0.02]">
          <Spinner size="sm" /> Loading chapters…
        </div>
      ) : chapters.length === 0 ? (
        <div className="py-8 text-center rounded-xl bg-white/[0.02]">
          <p className="text-sm text-gray-400">No chapters in this file</p>
          <p className="text-xs text-gray-400 mt-1">Full file will play as a single track</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="py-8 text-center rounded-xl bg-white/[0.02]">
          <p className="text-sm text-gray-400">No chapters match</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className="flex-1 min-h-0 overflow-auto overflow-x-hidden space-y-1 pr-1 scroll-smooth rounded-xl bg-white/[0.02] py-1.5"
          role="list"
        >
          {filteredEntries.map(({ ch, i }) => {
            const isCurrent = i === currentChapterIndex;
            return (
              <li key={i} ref={isCurrent ? currentChapterRef : undefined}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectChapter(i);
                    onToggleChapters(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg text-sm
                    transition-[background-color,color,box-shadow] duration-300 ease-out
                    flex items-center gap-3 min-w-0
                    ${isCurrent
                      ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]'
                      : 'text-gray-400 hover:bg-white/8 hover:text-gray-200 ring-1 ring-transparent'
                    }
                  `}
                >
                  <span
                    className={`
                      flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums
                      transition-colors duration-300 ease-out
                      ${isCurrent ? 'bg-amber-500/25 text-amber-300' : 'bg-white/5 text-gray-400'}
                    `}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium">
                    {ch.title || `Chapter ${i + 1}`}
                  </span>
                  <span
                    className={`
                      flex-shrink-0 text-xs tabular-nums transition-colors duration-300 ease-out
                      ${isCurrent ? 'text-amber-400/80' : 'text-gray-400'}
                    `}
                  >
                    {formatTime(ch.startSeconds)}
                  </span>
                  <span
                    className={`
                      flex-shrink-0 w-4 h-4 flex items-center justify-center text-amber-400
                      transition-opacity duration-300 ease-out
                      ${isCurrent ? 'opacity-100' : 'opacity-0'}
                    `}
                    aria-hidden
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
