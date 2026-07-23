import { Cog, Eye } from '@/components/icons';
import { formatSize } from '../../utils/formatters';

export function VideoInfoTechnicalDetails({ fileName, videoInfo }) {
  return (
    <div className="bg-white/5 rounded-lg p-5 border border-white/10">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Cog className="size-5 text-white/60" />
        Technical Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fileName && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">File Name</span>
            <p className="text-sm font-medium text-white mt-1 break-all">{fileName}</p>
          </div>
        )}
        {videoInfo.duration && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Duration</span>
            <p className="text-sm font-medium text-white mt-1">{videoInfo.duration}</p>
          </div>
        )}
        {videoInfo.width && videoInfo.height && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Resolution</span>
            <p className="text-sm font-medium text-white mt-1">
              {videoInfo.width}x{videoInfo.height}
              {videoInfo.title_data?.resolution && ` (${videoInfo.title_data.resolution})`}
            </p>
          </div>
        )}
        {videoInfo.codec && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Video Codec</span>
            <p className="text-sm font-medium text-white mt-1">{videoInfo.codec.toUpperCase()}</p>
          </div>
        )}
        {videoInfo.frame_rate && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Frame Rate</span>
            <p className="text-sm font-medium text-white mt-1">{videoInfo.frame_rate} fps</p>
          </div>
        )}
        {videoInfo.bitrate && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Bitrate</span>
            <p className="text-sm font-medium text-white mt-1">
              {Math.round(parseInt(videoInfo.bitrate) / 1000)}kbps
            </p>
          </div>
        )}
        {videoInfo.size && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">File Size</span>
            <p className="text-sm font-medium text-white mt-1">{formatSize(videoInfo.size)}</p>
          </div>
        )}
        {videoInfo.pixel_format && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Pixel Format</span>
            <p className="text-sm font-medium text-white mt-1 font-mono text-xs">
              {videoInfo.pixel_format}
            </p>
          </div>
        )}
        {videoInfo.total_chunks && (
          <div>
            <span className="text-xs text-white/60 uppercase tracking-wide">Total Chunks</span>
            <p className="text-sm font-medium text-white mt-1">{videoInfo.total_chunks}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoInfoAudioTracks({ audios }) {
  if (audios.length === 0) return null;

  return (
    <div className="bg-white/5 rounded-lg p-5 border border-white/10">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg
          className="size-5 text-white/60"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M2 10v3" />
          <path d="M6 6v11" />
          <path d="M10 3v18" />
          <path d="M14 8v7" />
          <path d="M18 5v13" />
          <path d="M22 10v3" />
        </svg>
        Audio Tracks ({audios.length})
      </h4>
      <div className="space-y-3">
        {audios.map((audio, idx) => (
          <div
            key={`${audio.language || ''}-${audio.language_full || ''}-${audio.codec || ''}-${audio.channels || ''}`}
            className="bg-white/5 rounded-lg p-3 border border-white/10"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-white">Track {idx + 1}</span>
                  {audio.default && (
                    <span className="px-2 py-0.5 rounded bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark text-xs font-medium border border-accent/30 dark:border-accent-dark/30">
                      Default
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/60">Language:</span>
                    <span className="text-white ml-2">
                      {audio.language_full || audio.language || 'Unknown'}
                    </span>
                  </div>
                  {audio.codec && (
                    <div>
                      <span className="text-white/60">Codec:</span>
                      <span className="text-white ml-2 font-mono">{audio.codec.toUpperCase()}</span>
                    </div>
                  )}
                  {audio.channels && (
                    <div>
                      <span className="text-white/60">Channels:</span>
                      <span className="text-white ml-2">
                        {audio.channels} ({audio.channel_layout || 'N/A'})
                      </span>
                    </div>
                  )}
                  {audio.sample_rate && (
                    <div>
                      <span className="text-white/60">Sample Rate:</span>
                      <span className="text-white ml-2">{audio.sample_rate}Hz</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VideoInfoSubtitleTracks({ subtitles }) {
  if (subtitles.length === 0) return null;

  return (
    <div className="bg-white/5 rounded-lg p-5 border border-white/10">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Eye className="size-5 text-white/60" />
        Subtitle Tracks ({subtitles.length})
      </h4>
      <div className="space-y-2">
        {subtitles.map((subtitle, idx) => (
          <div
            key={`${subtitle.language || ''}-${subtitle.language_full || ''}-${subtitle.codec || ''}`}
            className="bg-white/5 rounded-lg p-3 border border-white/10"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Track {idx + 1}</span>
              <span className="text-sm text-white/80">
                {subtitle.language_full || subtitle.language || 'Unknown'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
