'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import { useSessionStore } from '@/store/sessionStore';
import { getItem } from '@/utils/storage';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import {
  buildEpisodeStreamId,
  formatEpisodeCode,
  tmdbPosterUrl,
  tmdbStillUrl,
  yearFromAirDate,
} from '@/utils/tmdbSearchQuery';

function getApiKey() {
  return useSessionStore.getState().apiKey || getItem('torboxApiKey');
}

function Thumb({ src, landscape = false }) {
  const sizeClass = landscape
    ? 'h-12 w-[85px] shrink-0 rounded object-cover'
    : 'h-12 w-8 shrink-0 rounded object-cover';
  const placeholderClass = landscape
    ? 'flex h-12 w-[85px] shrink-0 items-center justify-center rounded bg-surface-alt text-[10px] text-primary-text/40 dark:bg-surface-alt-dark dark:text-primary-text-dark/40'
    : 'flex h-12 w-8 shrink-0 items-center justify-center rounded bg-surface-alt text-[10px] text-primary-text/40 dark:bg-surface-alt-dark dark:text-primary-text-dark/40';

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" referrerPolicy="no-referrer" className={sizeClass} />
    );
  }
  return <div className={placeholderClass}>—</div>;
}

/**
 * Two-step season/episode picker after selecting a TV title from TMDB suggestions.
 */
export default function EpisodePicker({ suggestion, onConfirm, onCancel }) {
  const t = useTranslations('TmdbSearch');
  const [step, setStep] = useState('seasons');
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seasonAbortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setStep('seasons');
      setSelectedSeason(null);
      setEpisodes([]);
      const apiKey = getApiKey();
      if (!apiKey) {
        setError(t('errors.apiKeyMissing'));
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/tmdb/tv/${suggestion.tmdbId}`, {
          headers: { 'x-api-key': apiKey },
          signal: controller.signal,
        });
        const { ok, data } = await readJsonFromResponse(res);
        if (cancelled) return;
        if (!ok || data.success === false) {
          setError(data.error || t('errors.tvLoadFailed'));
          setLoading(false);
          return;
        }
        setSeasons(Array.isArray(data.seasons) ? data.seasons : []);
        setLoading(false);
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        setError(t('errors.tvLoadFailed'));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
      seasonAbortRef.current?.abort();
    };
  }, [suggestion.tmdbId, t]);

  const loadSeason = async (season) => {
    seasonAbortRef.current?.abort();
    const controller = new AbortController();
    seasonAbortRef.current = controller;

    setSelectedSeason(season);
    setStep('episodes');
    setLoading(true);
    setError(null);
    setEpisodes([]);

    const apiKey = getApiKey();
    if (!apiKey) {
      setError(t('errors.apiKeyMissing'));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/tmdb/tv/${suggestion.tmdbId}/season/${season.seasonNumber}`, {
        headers: { 'x-api-key': apiKey },
        signal: controller.signal,
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (controller.signal.aborted) return;
      if (!ok || data.success === false) {
        setError(data.error || t('errors.seasonLoadFailed'));
        setLoading(false);
        return;
      }
      setEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
      setLoading(false);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(t('errors.seasonLoadFailed'));
      setLoading(false);
    }
  };

  const handleBack = () => {
    seasonAbortRef.current?.abort();
    setStep('seasons');
    setSelectedSeason(null);
    setEpisodes([]);
    setError(null);
    setLoading(false);
  };

  const handleEpisodeClick = (ep) => {
    if (!selectedSeason) return;
    const streamId = buildEpisodeStreamId(
      suggestion.streamId,
      selectedSeason.seasonNumber,
      ep.episodeNumber
    );
    if (!streamId) return;
    onConfirm(streamId, suggestion);
  };

  const metaLine = [t('typeTv'), suggestion.year || null, suggestion.imdbId || null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-md border border-border bg-white shadow-lg dark:border-border-dark dark:bg-[#1a1a1d]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border/60 bg-white px-3 py-2.5 dark:border-border-dark/60 dark:bg-[#1a1a1d]">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-primary-text dark:text-primary-text-dark">
            {step === 'episodes' && selectedSeason ? selectedSeason.name : suggestion.title}
          </div>
          <div className="truncate text-xs text-primary-text/50 dark:text-primary-text-dark/50">
            {step === 'episodes' && selectedSeason
              ? t('pickEpisode', { title: suggestion.title })
              : metaLine || t('pickEpisode', { title: suggestion.title })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {step === 'episodes' ? (
            <button
              type="button"
              onClick={handleBack}
              className="text-xs text-accent hover:underline dark:text-accent-dark"
            >
              {t('back')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-primary-text/60 hover:underline dark:text-primary-text-dark/60"
          >
            {t('cancel')}
          </button>
        </div>
      </div>

      <div className="p-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" className="text-accent dark:text-accent-dark" />
          </div>
        ) : error ? (
          <div className="space-y-2 px-2 py-2">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {step === 'episodes' ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-xs text-accent hover:underline dark:text-accent-dark"
              >
                {t('back')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-accent hover:underline dark:text-accent-dark"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        ) : step === 'seasons' ? (
          seasons.length === 0 ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-sm text-primary-text/60 dark:text-primary-text-dark/60">
                {t('noSeasons')}
              </p>
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-accent hover:underline dark:text-accent-dark"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <ul>
              {seasons.map((season) => {
                const poster = tmdbPosterUrl(season.posterPath);
                const year = yearFromAirDate(season.airDate);
                return (
                  <li key={season.seasonNumber}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-primary-text hover:bg-surface-alt dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
                      onClick={() => loadSeason(season)}
                    >
                      <Thumb src={poster} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{season.name}</span>
                        <span className="block text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                          {t('episodeCount', { count: season.episodeCount })}
                          {year ? ` · ${year}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : episodes.length === 0 ? (
          <div className="space-y-2 px-2 py-2">
            <p className="text-sm text-primary-text/60 dark:text-primary-text-dark/60">
              {t('noEpisodes')}
            </p>
            <button
              type="button"
              onClick={handleBack}
              className="text-xs text-accent hover:underline dark:text-accent-dark"
            >
              {t('back')}
            </button>
          </div>
        ) : (
          <ul>
            {episodes.map((ep) => {
              const still = tmdbStillUrl(ep.stillPath);
              return (
                <li key={ep.episodeNumber}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-primary-text hover:bg-surface-alt dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
                    onClick={() => handleEpisodeClick(ep)}
                  >
                    <Thumb src={still} landscape />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{ep.name}</span>
                      <span className="block text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                        {formatEpisodeCode(selectedSeason.seasonNumber, ep.episodeNumber)}
                        {ep.airDate ? ` · ${ep.airDate}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
