import { useEffect, useRef } from 'react';
import { POLLING_CONFIG } from './pollingConfig';

/**
 * SSE subscription for backend automation events — debounced torrent list refetch.
 *
 * @param {Object} options
 * @param {boolean} options.enabled
 * @param {string|null} options.apiKey
 * @param {(bypassCache?: boolean) => void | Promise<void>} options.onTorrentsChanged
 */
export function useAutomationTorrentEvents({ enabled, apiKey, onTorrentsChanged }) {
  const onTorrentsChangedRef = useRef(onTorrentsChanged);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    onTorrentsChangedRef.current = onTorrentsChanged;
  }, [onTorrentsChanged]);

  useEffect(() => {
    if (!enabled || !apiKey) return;

    const ac = new AbortController();
    let buffer = '';
    let reconnectTimer = null;
    let retryCount = 0;

    const scheduleTorrentRefetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        onTorrentsChangedRef.current(false);
      }, POLLING_CONFIG.sseDebounceMs);
    };

    const isPermanentError = (status) => status === 401 || status === 403 || status === 503;

    const reconnect = () => {
      if (ac.signal.aborted) return;
      const delay = Math.min(5000 * Math.pow(2, retryCount), 60_000);
      retryCount++;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (ac.signal.aborted) return;
      fetch('/api/automation/events', {
        headers: { 'x-api-key': apiKey },
        signal: ac.signal,
      })
        .then((res) => {
          if (!res.ok || !res.body) {
            if (isPermanentError(res.status)) return;
            reconnect();
            return;
          }
          retryCount = 0;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const read = () => {
            reader
              .read()
              .then(({ done, value }) => {
                if (ac.signal.aborted) return;
                if (done) {
                  retryCount = 0;
                  reconnect();
                  return;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    scheduleTorrentRefetch();
                    break;
                  }
                }
                read();
              })
              .catch((err) => {
                if (err?.name !== 'AbortError' && !ac.signal.aborted) reconnect();
              });
          };
          read();
        })
        .catch((err) => {
          if (err?.name !== 'AbortError' && !ac.signal.aborted) {
            console.debug('SSE automation/events closed or failed', err?.message);
            reconnect();
          }
        });
    };

    connect();

    const debounceTimer = debounceTimerRef.current;
    return () => {
      ac.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [enabled, apiKey]);
}
