'use client';

import Icons from '@/components/icons';
import { formatSize } from '../../utils/formatters';

/**
 * VideoInfoOverlay - Modal displaying video metadata and technical information
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether overlay is open
 * @param {Function} props.onClose - Callback to close overlay
 * @param {Object} props.metadata - Video metadata object
 * @param {string} props.fileName - File name
 * @param {Array} props.audios - Array of audio tracks
 * @param {Array} props.subtitles - Array of subtitle tracks
 */
export default function VideoInfoOverlay({ isOpen, onClose, metadata, fileName, audios = [], subtitles = [] }) {
  if (!isOpen) return null;

  const videoInfo = metadata?.video || {};

  return (
    <div 
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-black/90 backdrop-blur-md rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative border border-white/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Icons.Question className="w-6 h-6 text-accent dark:text-accent-dark" />
            Video Information
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            aria-label="Close Info"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Search Metadata Section */}
          {metadata?.search_metadata && (
            <div className="bg-gradient-to-br from-accent/10 to-accent/5 dark:from-accent-dark/10 dark:to-accent-dark/5 rounded-lg p-5 border border-accent/20 dark:border-accent-dark/20">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icons.Play className="w-5 h-5 text-accent dark:text-accent-dark" />
                Media Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metadata.search_metadata.title && (
                  <div className="md:col-span-2">
                    <span className="text-xs text-white/60 uppercase tracking-wide">Title</span>
                    <p className="text-lg font-medium text-white mt-1">{metadata.search_metadata.title}</p>
                  </div>
                )}
                {metadata.search_metadata.description && (
                  <div className="md:col-span-2">
                    <span className="text-xs text-white/60 uppercase tracking-wide">Description</span>
                    <p className="text-sm text-white/80 mt-1 leading-relaxed">{metadata.search_metadata.description}</p>
                  </div>
                )}
                {metadata.search_metadata.genres && metadata.search_metadata.genres.length > 0 && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Genres</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {metadata.search_metadata.genres.map((genre, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark text-xs font-medium border border-accent/30 dark:border-accent-dark/30">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {metadata.search_metadata.keywords && metadata.search_metadata.keywords.length > 0 && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Keywords</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {metadata.search_metadata.keywords.slice(0, 8).map((keyword, idx) => (
                        <span key={idx} className="px-2 py-1 rounded bg-white/5 text-white/70 text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {metadata.search_metadata.rating && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Rating</span>
                    <p className="text-lg font-semibold text-white mt-1 flex items-center gap-2">
                      <span className="text-accent dark:text-accent-dark">★</span>
                      {metadata.search_metadata.rating}/10
                    </p>
                  </div>
                )}
                {metadata.search_metadata.releaseYears && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Release Year</span>
                    <p className="text-lg font-medium text-white mt-1">{metadata.search_metadata.releaseYears}</p>
                  </div>
                )}
                {metadata.search_metadata.runtime && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Runtime</span>
                    <p className="text-lg font-medium text-white mt-1">{metadata.search_metadata.runtime}</p>
                  </div>
                )}
                {metadata.search_metadata.contentRating && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Content Rating</span>
                    <p className="text-lg font-medium text-white mt-1">{metadata.search_metadata.contentRating}</p>
                  </div>
                )}
                {metadata.search_metadata.mediaType && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Type</span>
                    <p className="text-lg font-medium text-white mt-1 capitalize">{metadata.search_metadata.mediaType}</p>
                  </div>
                )}
                {metadata.search_metadata.languages && metadata.search_metadata.languages.length > 0 && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Languages</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {metadata.search_metadata.languages.map((lang, idx) => (
                        <span key={idx} className="px-2 py-1 rounded bg-white/5 text-white/80 text-xs font-medium">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {metadata.search_metadata.imdb_id && (
                  <div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">IMDb ID</span>
                    <p className="text-sm font-mono text-white/80 mt-1">{metadata.search_metadata.imdb_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical Information Section */}
          <div className="bg-white/5 rounded-lg p-5 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Icons.Cog className="w-5 h-5 text-white/60" />
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
                  <p className="text-sm font-medium text-white mt-1">{Math.round(parseInt(videoInfo.bitrate) / 1000)}kbps</p>
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
                  <p className="text-sm font-medium text-white mt-1 font-mono text-xs">{videoInfo.pixel_format}</p>
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

          {/* Audio Tracks Section */}
          {audios.length > 0 && (
            <div className="bg-white/5 rounded-lg p-5 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
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
                  <div key={idx} className="bg-white/5 rounded-lg p-3 border border-white/10">
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
                            <span className="text-white ml-2">{audio.language_full || audio.language || 'Unknown'}</span>
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
                              <span className="text-white ml-2">{audio.channels} ({audio.channel_layout || 'N/A'})</span>
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
          )}

          {/* Subtitle Tracks Section */}
          {subtitles.length > 0 && (
            <div className="bg-white/5 rounded-lg p-5 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icons.Eye className="w-5 h-5 text-white/60" />
                Subtitle Tracks ({subtitles.length})
              </h4>
              <div className="space-y-2">
                {subtitles.map((subtitle, idx) => (
                  <div key={idx} className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Track {idx + 1}</span>
                      <span className="text-sm text-white/80">{subtitle.language_full || subtitle.language || 'Unknown'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
