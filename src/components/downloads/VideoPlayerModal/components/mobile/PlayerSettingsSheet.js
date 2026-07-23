'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import { SheetRow, SectionTitle } from './PlayerSettingsSheetParts';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function PlayerSettingsSheet({
  open,
  onClose,
  playbackSpeed,
  onPlaybackSpeedChange,
  audios,
  subtitles,
  selectedAudioIndex,
  selectedSubtitleIndex,
  onAudioSelect,
  onSubtitleSelect,
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  onInfoOpen,
  onFullscreen,
  isFullscreen,
}) {
  const t = useTranslations('VideoPlayer');
  const tView = useTranslations('ViewControls');

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      closeLabel={t('close')}
      dock
      overlayClassName="z-[60]"
      className="!z-[61] border-white/10 bg-neutral-900 text-white dark:bg-neutral-950"
      aria-label={t('settings')}
    >
      <div data-player-sheet className="flex max-h-[min(85dvh,28rem)] flex-col overflow-hidden">
        <ModalSheetHandle />
        <div className="border-b border-white/10 px-4 pb-3">
          <h2 className="text-base font-semibold text-white">{t('settings')}</h2>
        </div>

        <div className="ui-scrollbar flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
          <SectionTitle>{t('playbackSpeed')}</SectionTitle>
          {SPEED_OPTIONS.map((speed) => (
            <SheetRow
              key={speed}
              label={`${speed}x${speed === 1 ? ` (${t('playbackSpeedNormal')})` : ''}`}
              selected={playbackSpeed === speed}
              onClick={() => {
                onPlaybackSpeedChange(speed);
              }}
            />
          ))}

          {audios?.length > 0 && (
            <>
              <SectionTitle>{t('audioTracks')}</SectionTitle>
              {audios.map((track, idx) => (
                <SheetRow
                  key={track.index ?? track.id ?? `${track.language}-${track.language_full}`}
                  label={track.language_full || track.language || `Track ${idx + 1}`}
                  description={track.default ? t('defaultTrack') : undefined}
                  selected={selectedAudioIndex === idx}
                  onClick={() => {
                    onAudioSelect(idx);
                    onClose();
                  }}
                />
              ))}
            </>
          )}

          {subtitles?.length > 0 && (
            <>
              <SectionTitle>{t('subtitleTracks')}</SectionTitle>
              <SheetRow
                label={t('subtitlesOff')}
                selected={selectedSubtitleIndex === null}
                onClick={() => {
                  onSubtitleSelect(null);
                  onClose();
                }}
              />
              {subtitles.map((track, idx) => (
                <SheetRow
                  key={track.index ?? track.id ?? `${track.language}-${track.language_full}`}
                  label={track.language_full || track.language || `Track ${idx + 1}`}
                  selected={selectedSubtitleIndex === idx}
                  onClick={() => {
                    onSubtitleSelect(idx);
                    onClose();
                  }}
                />
              ))}
            </>
          )}

          <SectionTitle>{t('volume')}</SectionTitle>
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={onMuteToggle}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
              aria-label={isMuted ? t('unmute') : t('mute')}
            >
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                {isMuted || volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="h-2 flex-1 appearance-none rounded-full bg-white/20 accent-accent"
              aria-label={t('volume')}
            />
          </div>

          <SectionTitle>{t('moreOptions')}</SectionTitle>
          <SheetRow label={t('videoInfo')} onClick={onInfoOpen} />
          <SheetRow
            label={isFullscreen ? tView('exitFullscreen') : tView('enterFullscreen')}
            onClick={onFullscreen}
          />
        </div>
      </div>
    </ModalSheet>
  );
}

export default memo(PlayerSettingsSheet);
