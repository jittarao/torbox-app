import { useEffect, useRef } from 'react';
import { POLLING_CONFIG } from './pollingConfig';

/**
 * Parse SSE data line payload into a tag-change event.
 * @param {string} line
 * @returns {'tags_changed' | null}
 */
export function parseAutomationSseEvent(line) {
  if (!line.startsWith('data:')) return null;
  const raw = line.slice(5).trim();
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (payload?.event === 'tags_changed') return 'tags_changed';
    return null;
  } catch {
    return null;
  }
}

/**
 * SSE subscription for backend tag-mapping changes (automation, manual assign, tag CRUD).
 *
 * @param {Object} options
 * @param {boolean} options.enabled
 * @param {string|null} options.apiKey
 * @param {() => void | Promise<void>} [options.onTagsChanged]
 */
export function useAutomationEvents({ enabled, apiKey, onTagsChanged }) {
  const onTagsChangedRef = useRef(onTagsChanged);
  const tagsDebounceRef = useRef(null);

  useEffect(() => {
    onTagsChangedRef.current = onTagsChanged;
  }, [onTagsChanged]);

  useEffect(() => {
    if (!enabled || !apiKey || !onTagsChanged) return;

    const ac = new AbortController();
    let buffer = '';
    let reconnectTimer = null;
    let retryCount = 0;

    const scheduleTagsRefetch = () => {
      if (!onTagsChangedRef.current) return;
      if (tagsDebounceRef.current) clearTimeout(tagsDebounceRef.current);
      tagsDebounceRef.current = setTimeout(() => {
        tagsDebounceRef.current = null;
        onTagsChangedRef.current();
      }, POLLING_CONFIG.sseDebounceMs);
    };

    const handleSseLine = (line) => {
      if (parseAutomationSseEvent(line) === 'tags_changed') {
        scheduleTagsRefetch();
      }
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
                  handleSseLine(line);
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

    return () => {
      ac.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (tagsDebounceRef.current) {
        clearTimeout(tagsDebounceRef.current);
        tagsDebounceRef.current = null;
      }
    };
  }, [enabled, apiKey, onTagsChanged]);
}
